import mongoose, { type Types } from "mongoose";
import type { z } from "zod";

import type { ActiveAuthUser } from "@/domain/auth/types";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import type { collectTakeawaySchema } from "@/validation/order";

type CollectTakeawayInput = z.infer<typeof collectTakeawaySchema>;

type TakeawayOrderRecord = {
  _id: Types.ObjectId;
  orderType: string;
  status: string;
  paymentStatus: string;
  paymentType: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
};

type PaymentRecord = {
  _id: Types.ObjectId;
  method: "CASH" | "CARD" | "ONLINE";
};

export async function collectTakeaway(
  orderId: string,
  input: CollectTakeawayInput,
  user: ActiveAuthUser
) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(400, "Invalid takeaway order ID.", "INVALID_ORDER_ID");
  }

  return runInTransaction(async (session) => {
    const order = await Order.findById(orderId)
      .session(session)
      .lean<TakeawayOrderRecord>();
    if (!order) throw new ApiError(404, "Takeaway order not found.", "ORDER_NOT_FOUND");
    if (order.orderType !== "TAKE_AWAY") {
      throw new ApiError(400, "This action is only available for takeaway orders.", "NOT_TAKEAWAY");
    }
    if (order.status === "PICKED_UP") {
      throw new ApiError(409, "This takeaway order has already been collected.", "ALREADY_COLLECTED");
    }
    if (order.status !== "READY") {
      throw new ApiError(
        409,
        `The order cannot be collected because its current status is ${order.status}.`,
        "ORDER_NOT_READY"
      );
    }

    const amount = Number(order.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "The takeaway order total is invalid.", "INVALID_TOTAL");
    }

    const existingPayment = await Payment.findOne({
      order: order._id,
      status: "PAID",
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .session(session)
      .lean<PaymentRecord>();

    const alreadyPaid = order.paymentStatus === "PAID" || Boolean(existingPayment);
    if (!alreadyPaid && !input.paymentMethod) {
      throw new ApiError(
        400,
        "Select CASH or CARD before collecting an unpaid order.",
        "PAYMENT_METHOD_REQUIRED"
      );
    }

    const collectedAt = new Date();
    const historyNote =
      input.note ||
      (alreadyPaid
        ? "Prepared takeaway order handed over to the customer."
        : `Full payment received by ${input.paymentMethod} and order handed over to the customer.`);

    const update = await Order.updateOne(
      { _id: order._id, orderType: "TAKE_AWAY", status: "READY" },
      {
        $set: {
          status: "PICKED_UP",
          pickedUpAt: collectedAt,
          paymentStatus: "PAID",
        },
        $push: {
          statusHistory: {
            fromStatus: "READY",
            toStatus: "PICKED_UP",
            changedBy: user.id,
            changedByName: user.name,
            changedByRole: user.role,
            note: historyNote,
            changedAt: collectedAt,
          },
        },
      },
      { session, runValidators: true }
    );
    if (update.modifiedCount !== 1) {
      throw new ApiError(409, "This order was already updated. Please refresh.", "ORDER_CONFLICT");
    }

    let paymentId = existingPayment?._id.toString() ?? null;
    let paymentMethod = existingPayment?.method ?? input.paymentMethod ?? null;
    if (!alreadyPaid && input.paymentMethod) {
      const [payment] = await Payment.create(
        [
          {
            order: order._id,
            orders: [],
            diningSession: null,
            amount,
            method: input.paymentMethod,
            status: "PAID",
            paidAt: collectedAt,
            note: input.note || "Takeaway payment received at customer pickup.",
          },
        ],
        { session }
      );
      paymentId = payment._id.toString();
      paymentMethod = input.paymentMethod;
    }

    const pickupNumber = order._id.toString().slice(-6).toUpperCase();
    await createAuditLog(
      {
        action: "TAKEAWAY_ORDER_COLLECTED",
        module: "CASHIER",
        description: `${user.name} completed Takeaway Order #${pickupNumber} for ${
          order.customerName || "Customer"
        }. Total: Rs. ${amount}.`,
        performedBy: user.email,
        metadata: {
          orderId: order._id.toString(),
          pickupNumber,
          customerName: order.customerName || "",
          customerPhone: order.customerPhone || "",
          totalAmount: amount,
          paymentPreviouslyCompleted: alreadyPaid,
          paymentMethod,
          paymentId,
        },
      },
      { session, failClosed: true }
    );

    return {
      orderId: order._id.toString(),
      pickupNumber,
      orderStatus: "PICKED_UP" as const,
      displayStatus: "COLLECTED" as const,
      paymentStatus: "PAID" as const,
      paymentMethod,
      totalAmount: amount,
      collectedAt,
      paymentId,
      receiptUrl: `/cashier/receipt/${order._id.toString()}`,
      alreadyPaid,
    };
  });
}
