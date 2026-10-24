import mongoose, { type ClientSession, type Types } from "mongoose";

import type { ActiveAuthUser } from "@/domain/auth/types";
import { canTransitionOrder } from "@/domain/order/status-machine";
import type { OrderStatus } from "@/domain/order/types";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import Table from "@/models/Table";
import User from "@/models/User";

import "@/models/MenuItem";
import "@/models/ComboOffer";

const BACKUP_WAIT_TIME_MS = 4 * 60 * 1000;

type WaiterActionStatus = "PICKED_UP" | "DELIVERED";
type WorkStatus = "ON_DUTY" | "ON_BREAK" | "OFF_DUTY" | "ON_LEAVE";
type WaiterClaimType = "PRIMARY" | "BACKUP" | "SHARED";

type AssignmentOrder = {
  _id: Types.ObjectId;
  table: Types.ObjectId | null;
  orderType: "DINE_IN" | "TAKE_AWAY" | "ONLINE";
  status: OrderStatus;
  paymentStatus: string;
  assignedWaiter: Types.ObjectId | null;
  readyAt: Date | null;
  createdAt: Date;
};

type AssignmentTable = {
  _id: Types.ObjectId;
  name: string;
  assignedWaiter: Types.ObjectId | null;
};

type PrimaryWaiter = {
  _id: Types.ObjectId;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  workStatus?: WorkStatus | null;
};

function effectiveWorkStatus(value: unknown): WorkStatus {
  if (value === "ON_BREAK" || value === "OFF_DUTY" || value === "ON_LEAVE") {
    return value;
  }
  return "ON_DUTY";
}

async function loadTableContext(
  tableId: Types.ObjectId | null,
  session: ClientSession
): Promise<{ table: AssignmentTable | null; primaryWaiter: PrimaryWaiter | null }> {
  if (!tableId) return { table: null, primaryWaiter: null };

  const table = await Table.findById(tableId)
    .select("_id name assignedWaiter")
    .session(session)
    .lean<AssignmentTable>();
  if (!table) {
    throw new ApiError(
      404,
      "The table connected to this order was not found.",
      "TABLE_NOT_FOUND"
    );
  }

  const primaryWaiter = table.assignedWaiter
    ? await User.findOne({ _id: table.assignedWaiter, role: "WAITER" })
        .select("_id name status workStatus")
        .session(session)
        .lean<PrimaryWaiter>()
    : null;

  return { table, primaryWaiter };
}

function backupWaitMessage(
  order: AssignmentOrder,
  table: AssignmentTable | null,
  primaryWaiter: PrimaryWaiter | null
) {
  const timerStartTime = new Date(order.readyAt ?? order.createdAt).getTime();
  const remainingMs = BACKUP_WAIT_TIME_MS - (Date.now() - timerStartTime);
  if (remainingMs <= 0) return null;

  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const remainingText =
    minutes > 0
      ? `${minutes} minute(s) and ${seconds} second(s)`
      : `${seconds} second(s)`;

  return (
    `${table?.name ?? "This table"} is assigned to ` +
    `${primaryWaiter?.name ?? "another waiter"}. ` +
    `The order will become available to backup waiters in approximately ${remainingText}.`
  );
}

async function populateUpdatedOrder(orderId: string, session: ClientSession) {
  return Order.findById(orderId)
    .populate({
      path: "table",
      populate: {
        path: "assignedWaiter",
        select: "name email role status workStatus",
      },
    })
    .populate("assignedWaiter", "name email role status workStatus")
    .populate("assignedChef")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")
    .session(session)
    .lean();
}

export async function updateWaiterOrder(
  orderId: string,
  requestedStatus: WaiterActionStatus,
  note: string,
  user: ActiveAuthUser
) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid order ID.", "INVALID_ORDER_ID");
  }
  if (user.role !== "WAITER") {
    throw new ApiError(403, "Only waiter accounts can update waiter orders.", "FORBIDDEN");
  }

  const waiterWorkStatus = effectiveWorkStatus(user.workStatus);
  if (requestedStatus === "PICKED_UP" && waiterWorkStatus !== "ON_DUTY") {
    throw new ApiError(
      403,
      `You are currently ${waiterWorkStatus.replaceAll("_", " ")}. Return to duty before claiming an order.`,
      "WAITER_NOT_ON_DUTY"
    );
  }

  return runInTransaction(async (session) => {
    const order = await Order.findById(orderId)
      .select(
        "_id table orderType status paymentStatus assignedWaiter readyAt createdAt"
      )
      .session(session)
      .lean<AssignmentOrder>();
    if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
    if (!canTransitionOrder(order.status, requestedStatus)) {
      throw new ApiError(
        409,
        `Order cannot change from ${order.status} to ${requestedStatus}. Please refresh the dashboard.`,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const { table, primaryWaiter } = await loadTableContext(order.table, session);
    const loggedInWaiterId = user.id;
    const assignedWaiterId = order.assignedWaiter?.toString() ?? null;

    if (requestedStatus === "PICKED_UP") {
      if (assignedWaiterId && assignedWaiterId !== loggedInWaiterId) {
        throw new ApiError(
          409,
          "This order has already been claimed by another waiter.",
          "ORDER_ALREADY_CLAIMED"
        );
      }

      const primaryWaiterId = table?.assignedWaiter?.toString() ?? null;
      const primaryWorkStatus = primaryWaiter
        ? effectiveWorkStatus(primaryWaiter.workStatus)
        : null;
      const primaryAvailable =
        primaryWaiter?.status === "ACTIVE" && primaryWorkStatus === "ON_DUTY";

      let claimType: WaiterClaimType;
      if (!primaryWaiterId) claimType = "SHARED";
      else if (primaryWaiterId === loggedInWaiterId) claimType = "PRIMARY";
      else if (!primaryAvailable) claimType = "BACKUP";
      else {
        const waitMessage = backupWaitMessage(order, table, primaryWaiter);
        if (waitMessage) {
          throw new ApiError(403, waitMessage, "BACKUP_WAIT_REQUIRED");
        }
        claimType = "BACKUP";
      }

      const changedAt = new Date();
      const claimNote =
        note ||
        (claimType === "PRIMARY"
          ? "Primary waiter claimed and picked up the order."
          : claimType === "SHARED"
            ? "Waiter claimed an order from a shared table."
            : primaryAvailable
              ? "Backup waiter claimed the order after the four-minute timeout."
              : "Backup waiter claimed the order because the primary waiter was unavailable.");

      const claimed = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: "READY",
          $or: [
            { assignedWaiter: null },
            { assignedWaiter: { $exists: false } },
            { assignedWaiter: user.id },
          ],
        },
        {
          $set: {
            status: "PICKED_UP",
            assignedWaiter: user.id,
            waiterClaimedAt: changedAt,
            waiterClaimType: claimType,
            pickedUpAt: changedAt,
          },
          $push: {
            statusHistory: {
              fromStatus: "READY",
              toStatus: "PICKED_UP",
              changedBy: user.id,
              changedByName: user.name,
              changedByRole: "WAITER",
              note: claimNote,
              changedAt,
            },
          },
        },
        { new: true, runValidators: true, session }
      );
      if (!claimed) {
        throw new ApiError(
          409,
          "Another waiter claimed this order first. Please refresh the dashboard.",
          "ORDER_ALREADY_CLAIMED"
        );
      }

      await createAuditLog(
        {
          action: "WAITER_ORDER_CLAIMED",
          module: "WAITER",
          description: `${user.name} claimed Order #${orderId.slice(-6).toUpperCase()} for ${table?.name ?? "Takeaway / Online order"} as ${claimType}.`,
          performedBy: user.email,
          metadata: {
            orderId,
            waiterId: user.id,
            tableId: table?._id.toString() ?? null,
            claimType,
            primaryWaiterId,
            primaryWaiterAvailable: primaryAvailable,
            primaryWaiterWorkStatus: primaryWorkStatus,
          },
        },
        { session, failClosed: true }
      );

      return {
        message:
          claimType === "BACKUP"
            ? primaryAvailable
              ? "Backup order claimed after the four-minute timeout."
              : "Backup order claimed because the primary waiter is unavailable."
            : claimType === "PRIMARY"
              ? "Primary order picked up successfully."
              : "Shared order picked up successfully.",
        order: await populateUpdatedOrder(orderId, session),
      };
    }

    if (!assignedWaiterId) {
      throw new ApiError(
        409,
        "This order has no assigned waiter. Pick up the order first.",
        "ORDER_NOT_CLAIMED"
      );
    }
    if (assignedWaiterId !== loggedInWaiterId) {
      throw new ApiError(
        403,
        "Only the waiter who claimed this order can mark it as delivered.",
        "NOT_ASSIGNED_WAITER"
      );
    }

    const changedAt = new Date();
    const delivered = await Order.findOneAndUpdate(
      { _id: orderId, status: "PICKED_UP", assignedWaiter: user.id },
      {
        $set: { status: "DELIVERED", deliveredAt: changedAt },
        $push: {
          statusHistory: {
            fromStatus: "PICKED_UP",
            toStatus: "DELIVERED",
            changedBy: user.id,
            changedByName: user.name,
            changedByRole: "WAITER",
            note: note || "Order delivered to the customer.",
            changedAt,
          },
        },
      },
      { new: true, runValidators: true, session }
    );
    if (!delivered) {
      throw new ApiError(
        409,
        "The order was already updated. Please refresh the dashboard.",
        "CONCURRENT_ORDER_UPDATE"
      );
    }

    if (
      order.orderType === "DINE_IN" &&
      table &&
      order.paymentStatus === "PAID"
    ) {
      await Table.updateOne(
        { _id: table._id, status: "OCCUPIED" },
        { $set: { status: "AVAILABLE" } },
        { session }
      );
    }

    await createAuditLog(
      {
        action: "WAITER_ORDER_DELIVERED",
        module: "WAITER",
        description: `${user.name} delivered Order #${orderId.slice(-6).toUpperCase()} for ${table?.name ?? "Takeaway / Online order"}.`,
        performedBy: user.email,
        metadata: {
          orderId,
          waiterId: user.id,
          tableId: table?._id.toString() ?? null,
        },
      },
      { session, failClosed: true }
    );

    return {
      message: "Order delivered successfully.",
      order: await populateUpdatedOrder(orderId, session),
    };
  });
}
