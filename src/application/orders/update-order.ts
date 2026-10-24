import crypto from "crypto";
import mongoose, {
  type ClientSession,
  type HydratedDocument,
  type Types,
} from "mongoose";

import { resolveOrderSelection } from "@/application/orders/order-selection";
import { aggregateQuantities, mapToMenuQuantities } from "@/domain/order/calculations";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import { connectDB } from "@/lib/mongodb";
import {
  deductStockForOrder,
  restoreStockForOrder,
  type OrderItemInput,
} from "@/lib/inventory";
import DiningSession from "@/models/DiningSession";
import Order from "@/models/Order";
import Table from "@/models/Table";
import type { publicOrderUpdateSchema } from "@/validation/order";
import type { z } from "zod";

type UpdateOrderInput = z.infer<typeof publicOrderUpdateSchema>;

type StoredOrderItem = {
  menuItem: Types.ObjectId;
  quantity: number;
  price: number;
};

type StoredComboItem = {
  comboOffer: Types.ObjectId;
  quantity: number;
  comboItemsSnapshot: Array<{
    menuItem: Types.ObjectId;
    quantity: number;
  }>;
};

type OrderShape = {
  _id: Types.ObjectId;
  table: Types.ObjectId | null;
  diningSession: Types.ObjectId | null;
  orderType: "DINE_IN" | "TAKE_AWAY" | "ONLINE";
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "PARTIALLY_PAID";
  customerEditToken: string;
  customerName: string;
  customerPhone: string;
  items: StoredOrderItem[];
  comboItems: StoredComboItem[];
  totalAmount: number;
  cancelledAt: Date | null;
  statusHistory: Array<Record<string, unknown>>;
};

type MutableOrder = HydratedDocument<OrderShape>;

function tokensMatch(stored: string, supplied: string): boolean {
  const storedBuffer = Buffer.from(stored);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    storedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, suppliedBuffer)
  );
}

function flattenStoredItems(order: OrderShape): OrderItemInput[] {
  const quantities = aggregateQuantities(
    order.items,
    (item) => item.menuItem.toString(),
    (item) => Number(item.quantity)
  );

  for (const combo of order.comboItems) {
    for (const item of combo.comboItemsSnapshot) {
      const menuItemId = item.menuItem.toString();
      const quantity = Number(item.quantity) * Number(combo.quantity);
      quantities.set(menuItemId, (quantities.get(menuItemId) ?? 0) + quantity);
    }
  }

  return mapToMenuQuantities(quantities);
}

async function releaseCancelledTable(
  order: OrderShape,
  session: ClientSession
) {
  if (!order.table || order.orderType !== "DINE_IN") return;

  const anotherActiveOrder = await Order.exists({
    _id: { $ne: order._id },
    table: order.table,
    status: { $ne: "CANCELLED" },
    ...(order.diningSession ? { diningSession: order.diningSession } : {}),
  }).session(session);

  if (anotherActiveOrder) return;

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
    { _id: order.table },
    { $set: { status: "AVAILABLE" } },
    { session }
  );
}

export async function updateCustomerOrder(orderId: string, input: UpdateOrderInput) {
  return runInTransaction(async (session) => {
    const order = (await Order.findById(orderId)
      .select("+customerEditToken")
      .session(session)) as MutableOrder | null;

    if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
    if (!tokensMatch(order.customerEditToken, input.editToken)) {
      throw new ApiError(403, "You are not allowed to edit this order.", "INVALID_EDIT_TOKEN");
    }
    if (order.status !== "PENDING") {
      throw new ApiError(
        409,
        "Kitchen has already accepted this order. Please place a new order for extra items.",
        "ORDER_NOT_EDITABLE"
      );
    }

    const oldStockItems = flattenStoredItems(order);
    const now = new Date();

    if (input.cancel) {
      if (oldStockItems.length > 0) {
        await restoreStockForOrder(
          oldStockItems,
          order._id,
          "Stock restored because the customer cancelled the order",
          session
        );
      }

      order.status = "CANCELLED";
      order.cancelledAt = now;
      order.statusHistory.push({
        fromStatus: "PENDING",
        toStatus: "CANCELLED",
        changedBy: null,
        changedByName: "Customer",
        changedByRole: "CUSTOMER",
        note: "Order cancelled by customer",
        changedAt: now,
      });
      await order.save({ session });
      await releaseCancelledTable(order, session);

      await createAuditLog(
        {
          action: "ORDER_CANCELLED",
          module: "PUBLIC_ORDER",
          description: `Order #${order._id.toString().slice(-6).toUpperCase()} cancelled by customer.`,
          performedBy: "Customer",
          metadata: { orderId: order._id.toString() },
        },
        { session, failClosed: true }
      );

      return order.toObject();
    }

    if (order.paymentStatus === "PAID") {
      throw new ApiError(
        409,
        "This order is already paid. Please place a new order for extra items.",
        "ORDER_ALREADY_PAID"
      );
    }

    const normalQuantities = aggregateQuantities(
      input.items ?? [],
      (item) => item.menuItemId,
      (item) => item.quantity
    );
    const comboQuantities = aggregateQuantities(
      input.comboItems ?? [],
      (item) => item.comboOfferId,
      (item) => item.quantity
    );
    const selection = await resolveOrderSelection(
      normalQuantities,
      comboQuantities,
      session
    );

    if (oldStockItems.length > 0) {
      await restoreStockForOrder(
        oldStockItems,
        order._id,
        "Stock restored before customer order edit",
        session
      );
    }

    const newOrderForFlattening: OrderShape = {
      ...order.toObject(),
      items: selection.orderItems,
      comboItems: selection.orderComboItems,
    };
    const newStockItems = flattenStoredItems(newOrderForFlattening);
    if (newStockItems.length > 0) {
      await deductStockForOrder(
        newStockItems,
        order._id,
        "Stock deducted after customer order edit",
        session
      );
    }

    order.customerName = input.customerName;
    order.customerPhone = input.customerPhone;
    order.items = selection.orderItems;
    order.comboItems = selection.orderComboItems;
    order.totalAmount = selection.totalAmount;
    order.statusHistory.push({
      fromStatus: "PENDING",
      toStatus: "PENDING",
      changedBy: null,
      changedByName: "Customer",
      changedByRole: "CUSTOMER",
      note: "Customer edited pending order before kitchen acceptance",
      changedAt: now,
    });
    await order.save({ session });

    await createAuditLog(
      {
        action: "CUSTOMER_ORDER_EDITED",
        module: "PUBLIC_ORDER",
        description: `Customer edited Order #${order._id.toString().slice(-6).toUpperCase()}.`,
        performedBy: "Customer",
        metadata: { orderId: order._id.toString(), totalAmount: selection.totalAmount },
      },
      { session, failClosed: true }
    );

    return Order.findById(order._id)
      .populate("table")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .session(session)
      .lean();
  });
}

export async function getCustomerOrder(orderId: string, editToken: string) {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID.", "INVALID_ORDER_ID");
  }

  const order = (await Order.findById(orderId)
    .select("+customerEditToken")
    .populate("table")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")) as MutableOrder | null;

  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (!editToken || !tokensMatch(order.customerEditToken, editToken)) {
    throw new ApiError(403, "You are not allowed to view this order.", "INVALID_EDIT_TOKEN");
  }

  const result = order.toObject() as Record<string, unknown>;
  delete result.customerEditToken;
  return result;
}
