import { type ClientSession, type Types } from "mongoose";

import type { ActiveAuthUser } from "@/domain/auth/types";
import type { PaymentMethod, PaymentStatus } from "@/domain/order/types";
import { buildSessionPaymentPlan } from "@/domain/payment/billing";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import DiningSession from "@/models/DiningSession";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import Table from "@/models/Table";

type TableReference = {
  _id: Types.ObjectId;
  name: string;
};

type SessionRecord = {
  _id: Types.ObjectId;
  table: TableReference | Types.ObjectId;
  status: "OPEN" | "CLOSED";
  paymentStatus: "UNPAID" | "PAID";
};

type OrderRecord = {
  _id: Types.ObjectId;
  table: TableReference | Types.ObjectId | null;
  diningSession: Types.ObjectId | null;
  orderType: "DINE_IN" | "TAKE_AWAY" | "ONLINE";
  totalAmount: number;
  status: string;
  paymentStatus: PaymentStatus;
};

type SettlePaymentInput = {
  orderId?: string;
  diningSessionId?: string;
  method: PaymentMethod;
  note: string;
};

export type SettlePaymentResult = {
  paymentId: string;
  orderId?: string;
  diningSessionId?: string;
  orderIds?: string[];
  orderCount?: number;
  amount: number;
  method: PaymentMethod;
  paymentStatus: "PAID";
  receiptUrl: string;
};

function tableId(value: OrderRecord["table"] | SessionRecord["table"]) {
  if (!value) return null;
  return "_id" in value ? value._id : value;
}

function tableName(value: OrderRecord["table"] | SessionRecord["table"]) {
  return value && "name" in value ? value.name : "Dining table";
}

async function releaseLegacyTableIfSafe(
  order: OrderRecord,
  session: ClientSession
) {
  const id = tableId(order.table);
  if (!id || order.orderType !== "DINE_IN" || order.status !== "DELIVERED") return;

  const blockingOrder = await Order.exists({
    _id: { $ne: order._id },
    table: id,
    orderType: "DINE_IN",
    status: { $ne: "CANCELLED" },
    $or: [{ status: { $ne: "DELIVERED" } }, { paymentStatus: { $ne: "PAID" } }],
  }).session(session);

  if (!blockingOrder) {
    await Table.updateOne(
      { _id: id },
      { $set: { status: "AVAILABLE" } },
      { session }
    );
  }
}

async function settleDiningSession(
  diningSessionId: string,
  method: PaymentMethod,
  note: string,
  user: ActiveAuthUser,
  session: ClientSession
): Promise<SettlePaymentResult> {
  const diningSession = await DiningSession.findById(diningSessionId)
    .populate("table")
    .session(session)
    .lean<SessionRecord>();

  if (!diningSession) {
    throw new ApiError(404, "Dining session not found.", "SESSION_NOT_FOUND");
  }
  if (diningSession.status === "CLOSED" || diningSession.paymentStatus === "PAID") {
    throw new ApiError(409, "This dining session is already paid and closed.", "SESSION_ALREADY_PAID");
  }

  const sessionOrders = await Order.find({
    diningSession: diningSession._id,
    orderType: "DINE_IN",
    status: { $ne: "CANCELLED" },
  })
    .sort({ createdAt: 1 })
    .populate("table")
    .session(session)
    .lean<OrderRecord[]>();

  if (sessionOrders.length === 0) {
    throw new ApiError(404, "No orders were found in this dining session.", "SESSION_EMPTY");
  }

  const paymentPlan = buildSessionPaymentPlan(sessionOrders);
  const { incompleteCount, unpaidOrders, amount } = paymentPlan;
  if (incompleteCount > 0) {
    throw new ApiError(
      409,
      `${incompleteCount} order(s) are not delivered yet. Deliver all table orders before settling the final bill.`,
      "ORDERS_NOT_DELIVERED"
    );
  }

  if (unpaidOrders.length === 0) {
    throw new ApiError(409, "All orders in this dining session are already paid.", "ORDERS_ALREADY_PAID");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "The combined bill amount is invalid.", "INVALID_PAYMENT_AMOUNT");
  }

  const paidAt = new Date();
  const lock = await DiningSession.updateOne(
    { _id: diningSession._id, status: "OPEN", paymentStatus: "UNPAID" },
    {
      $set: { status: "CLOSED", paymentStatus: "PAID", closedAt: paidAt },
    },
    { session }
  );
  if (lock.modifiedCount !== 1) {
    throw new ApiError(409, "This bill is already being processed or paid.", "PAYMENT_CONFLICT");
  }

  const orderIds = unpaidOrders.map((order) => order._id);
  const [payment] = await Payment.create(
    [
      {
        order: null,
        orders: orderIds,
        diningSession: diningSession._id,
        amount,
        method,
        status: "PAID",
        paidAt,
        note,
      },
    ],
    { session }
  );

  const orderUpdate = await Order.updateMany(
    { _id: { $in: orderIds }, paymentStatus: { $ne: "PAID" } },
    {
      $set: { paymentStatus: "PAID" },
      $push: {
        statusHistory: {
          fromStatus: "DELIVERED",
          toStatus: "DELIVERED",
          changedBy: user.id,
          changedByName: user.name,
          changedByRole: user.role,
          note: `Combined bill paid using ${method}.`,
          changedAt: paidAt,
        },
      },
    },
    { session }
  );

  if (orderUpdate.modifiedCount !== unpaidOrders.length) {
    throw new ApiError(409, "One or more orders changed during payment.", "PAYMENT_CONFLICT");
  }

  const sessionTableId = tableId(diningSession.table);
  if (sessionTableId) {
    await Table.updateOne(
      { _id: sessionTableId },
      { $set: { status: "AVAILABLE" } },
      { session }
    );
  }

  await createAuditLog(
    {
      action: "DINING_SESSION_PAYMENT_SETTLED",
      module: "CASHIER",
      description: `${user.name} settled the combined bill for ${tableName(
        diningSession.table
      )}. ${unpaidOrders.length} order(s), amount Rs. ${amount}, method ${method}.`,
      performedBy: user.email,
      metadata: {
        diningSessionId: diningSession._id.toString(),
        tableId: sessionTableId?.toString() ?? null,
        orderIds: orderIds.map((id) => id.toString()),
        orderCount: unpaidOrders.length,
        amount,
        method,
      },
    },
    { session, failClosed: true }
  );

  return {
    paymentId: payment._id.toString(),
    diningSessionId: diningSession._id.toString(),
    orderIds: orderIds.map((id) => id.toString()),
    orderCount: unpaidOrders.length,
    amount,
    method,
    paymentStatus: "PAID",
    receiptUrl: `/cashier/receipt/session/${diningSession._id.toString()}`,
  };
}

async function settleSingleOrder(
  orderId: string,
  method: PaymentMethod,
  note: string,
  user: ActiveAuthUser,
  session: ClientSession
): Promise<SettlePaymentResult> {
  const order = await Order.findById(orderId)
    .populate("table")
    .session(session)
    .lean<OrderRecord>();

  if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
  if (order.orderType === "DINE_IN" && order.diningSession) {
    throw new ApiError(
      400,
      "This order belongs to a dining session. Please settle the combined table bill.",
      "COMBINED_BILL_REQUIRED",
      { diningSessionId: order.diningSession.toString() }
    );
  }
  if (order.status === "CANCELLED") {
    throw new ApiError(409, "A cancelled order cannot be paid.", "ORDER_CANCELLED");
  }
  if (order.paymentStatus === "PAID") {
    throw new ApiError(409, "This order is already paid.", "ORDER_ALREADY_PAID");
  }
  if (order.orderType === "DINE_IN" && order.status !== "DELIVERED") {
    throw new ApiError(409, "Deliver the dine-in order before settling the bill.", "ORDER_NOT_DELIVERED");
  }

  const existingPayment = await Payment.exists({
    status: "PAID",
    $or: [{ order: order._id }, { orders: order._id }],
  }).session(session);
  if (existingPayment) {
    throw new ApiError(409, "A paid payment record already exists for this order.", "PAYMENT_EXISTS");
  }

  const amount = Number(Number(order.totalAmount).toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "The order amount is invalid.", "INVALID_PAYMENT_AMOUNT");
  }

  const paidAt = new Date();
  const lock = await Order.updateOne(
    { _id: order._id, paymentStatus: { $ne: "PAID" }, status: { $ne: "CANCELLED" } },
    {
      $set: { paymentStatus: "PAID" },
      $push: {
        statusHistory: {
          fromStatus: order.status,
          toStatus: order.status,
          changedBy: user.id,
          changedByName: user.name,
          changedByRole: user.role,
          note: `Payment settled using ${method}.`,
          changedAt: paidAt,
        },
      },
    },
    { session }
  );
  if (lock.modifiedCount !== 1) {
    throw new ApiError(409, "This order is already being processed or paid.", "PAYMENT_CONFLICT");
  }

  const [payment] = await Payment.create(
    [
      {
        order: order._id,
        orders: [],
        diningSession: null,
        amount,
        method,
        status: "PAID",
        paidAt,
        note,
      },
    ],
    { session }
  );

  await releaseLegacyTableIfSafe({ ...order, paymentStatus: "PAID" }, session);

  await createAuditLog(
    {
      action: "PAYMENT_SETTLED",
      module: "CASHIER",
      description: `${user.name} settled payment for Order #${order._id
        .toString()
        .slice(-6)
        .toUpperCase()} (${tableName(order.table)}) using ${method}. Amount: Rs. ${amount}.`,
      performedBy: user.email,
      metadata: { orderId: order._id.toString(), amount, method },
    },
    { session, failClosed: true }
  );

  return {
    paymentId: payment._id.toString(),
    orderId: order._id.toString(),
    amount,
    method,
    paymentStatus: "PAID",
    receiptUrl: `/cashier/receipt/${order._id.toString()}`,
  };
}

export async function settlePayment(
  input: SettlePaymentInput,
  user: ActiveAuthUser
): Promise<SettlePaymentResult> {
  return runInTransaction((session) =>
    input.diningSessionId
      ? settleDiningSession(input.diningSessionId, input.method, input.note, user, session)
      : settleSingleOrder(input.orderId ?? "", input.method, input.note, user, session)
  );
}
