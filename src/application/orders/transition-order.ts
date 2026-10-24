import mongoose, { type HydratedDocument, type Types } from "mongoose";

import type { ActiveAuthUser } from "@/domain/auth/types";
import {
  canTransitionOrder,
} from "@/domain/order/status-machine";
import type { OrderStatus } from "@/domain/order/types";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import { restoreStockForOrder, type OrderItemInput } from "@/lib/inventory";
import Order from "@/models/Order";
import DiningSession from "@/models/DiningSession";
import Table from "@/models/Table";

type TransitionOrderShape = {
  _id: Types.ObjectId;
  table: { _id: Types.ObjectId; name: string } | Types.ObjectId | null;
  orderType: "DINE_IN" | "TAKE_AWAY" | "ONLINE";
  status: OrderStatus;
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "PARTIALLY_PAID";
  diningSession: Types.ObjectId | null;
  items: Array<{ menuItem: Types.ObjectId; quantity: number }>;
  comboItems: Array<{
    quantity: number;
    comboItemsSnapshot: Array<{ menuItem: Types.ObjectId; quantity: number }>;
  }>;
  assignedChef: Types.ObjectId | null;
  acceptedAt: Date | null;
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  statusHistory: Array<Record<string, unknown>>;
};

type TransitionOrderDocument = HydratedDocument<TransitionOrderShape>;

type TransitionOptions = {
  channel: "KITCHEN" | "CASHIER_DELIVERY" | "ADMIN";
  allowedStatuses: readonly OrderStatus[];
};

function stockItems(order: TransitionOrderShape): OrderItemInput[] {
  const quantities = new Map<string, number>();
  for (const item of order.items) {
    const id = item.menuItem.toString();
    quantities.set(id, (quantities.get(id) ?? 0) + Number(item.quantity));
  }
  for (const combo of order.comboItems) {
    for (const item of combo.comboItemsSnapshot) {
      const id = item.menuItem.toString();
      const quantity = Number(item.quantity) * Number(combo.quantity);
      quantities.set(id, (quantities.get(id) ?? 0) + quantity);
    }
  }
  return Array.from(quantities, ([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}

function location(order: TransitionOrderShape): string {
  if (order.orderType === "TAKE_AWAY") return "Counter pickup";
  return order.table && "name" in order.table ? order.table.name : "Unknown table";
}

export async function transitionOrder(
  orderId: string,
  nextStatus: OrderStatus,
  note: string,
  user: ActiveAuthUser,
  options: TransitionOptions
) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID.", "INVALID_ORDER_ID");
  }
  if (!options.allowedStatuses.includes(nextStatus)) {
    throw new ApiError(403, "This role cannot apply the requested status.", "STATUS_FORBIDDEN");
  }

  return runInTransaction(async (session) => {
    const order = (await Order.findById(orderId)
      .populate("table")
      .session(session)) as TransitionOrderDocument | null;

    if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
    if (!canTransitionOrder(order.status, nextStatus)) {
      throw new ApiError(
        409,
        `Cannot change order from ${order.status} to ${nextStatus}. Please refresh the page.`,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const previousStatus = order.status;
    const changedAt = new Date();

    if (nextStatus === "CANCELLED" && order.paymentStatus === "PAID") {
      throw new ApiError(
        409,
        "A paid order cannot be cancelled without a refund workflow.",
        "REFUND_REQUIRED"
      );
    }
    order.status = nextStatus;

    if (nextStatus === "ACCEPTED") {
      order.acceptedAt = changedAt;
      order.assignedChef = new mongoose.Types.ObjectId(user.id);
    } else if (nextStatus === "PREPARING") {
      order.preparingStartedAt = changedAt;
    } else if (nextStatus === "READY") {
      order.readyAt = changedAt;
    } else if (nextStatus === "PICKED_UP") {
      order.pickedUpAt = changedAt;
    } else if (nextStatus === "DELIVERED") {
      order.deliveredAt = changedAt;
    } else if (nextStatus === "CANCELLED") {
      order.cancelledAt = changedAt;
      const itemsToRestore = stockItems(order);
      if (itemsToRestore.length > 0) {
        await restoreStockForOrder(
          itemsToRestore,
          order._id,
          "Stock restored because an administrator cancelled the order",
          session
        );
      }
    }

    order.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: nextStatus,
      changedBy: user.id,
      changedByName: user.name,
      changedByRole: user.role,
      note,
      changedAt,
    });
    await order.save({ session });

    if (
      nextStatus === "CANCELLED" &&
      order.orderType === "DINE_IN" &&
      order.table
    ) {
      const tableId = "_id" in order.table ? order.table._id : order.table;
      const anotherActiveOrder = await Order.exists({
        _id: { $ne: order._id },
        table: tableId,
        status: { $ne: "CANCELLED" },
        ...(order.diningSession ? { diningSession: order.diningSession } : {}),
      }).session(session);
      if (!anotherActiveOrder) {
        if (order.diningSession) {
          await DiningSession.deleteOne(
            {
              _id: order.diningSession,
              status: "OPEN",
              paymentStatus: "UNPAID",
            },
            { session }
          );
        }
        await Table.updateOne(
          { _id: tableId },
          { $set: { status: "AVAILABLE" } },
          { session }
        );
      }
    }

    await createAuditLog(
      {
        action:
          options.channel === "KITCHEN"
            ? "KITCHEN_ORDER_UPDATED"
            : options.channel === "ADMIN"
              ? "ADMIN_ORDER_UPDATED"
              : "DELIVERY_ORDER_UPDATED",
        module:
          options.channel === "KITCHEN"
            ? "KITCHEN"
            : options.channel === "ADMIN"
              ? "ADMIN_ORDERS"
              : "CASHIER",
        description: `${user.name} changed Order #${order._id
          .toString()
          .slice(-6)
          .toUpperCase()} for ${location(order)} from ${previousStatus} to ${nextStatus}.`,
        performedBy: user.email,
        metadata: {
          orderId: order._id.toString(),
          fromStatus: previousStatus,
          toStatus: nextStatus,
          orderType: order.orderType,
        },
      },
      { session, failClosed: true }
    );

    return order.toObject();
  });
}
