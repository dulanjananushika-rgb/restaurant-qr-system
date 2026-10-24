import crypto from "crypto";
import type { HydratedDocument, Types } from "mongoose";

import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import Order from "@/models/Order";
import Payment from "@/models/Payment";

type PublicPaymentOrder = {
  _id: Types.ObjectId;
  table: Types.ObjectId | null;
  orderType: "DINE_IN" | "TAKE_AWAY" | "ONLINE";
  status: string;
  paymentStatus: string;
  paymentType: "PAY_NOW" | "PAY_LATER";
  customerEditToken: string;
  totalAmount: number;
  statusHistory: Array<Record<string, unknown>>;
};

type PublicPaymentOrderDocument = HydratedDocument<PublicPaymentOrder>;

type ExistingPayment = {
  _id: Types.ObjectId;
  amount: number;
};

function tokensMatch(stored: string, supplied: string): boolean {
  const storedBuffer = Buffer.from(stored);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    storedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, suppliedBuffer)
  );
}

export type PublicPaymentResult = {
  paymentId: string;
  orderId: string;
  amount: number;
  paymentStatus: "PAID";
  successUrl: string;
  receiptUrl: string;
  alreadyPaid: boolean;
};

export async function completePublicPayment(
  orderId: string,
  accessToken: string,
  note: string
): Promise<PublicPaymentResult> {
  return runInTransaction(async (session) => {
    const order = (await Order.findById(orderId)
      .select("+customerEditToken")
      .session(session)) as PublicPaymentOrderDocument | null;

    if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
    if (!accessToken || !tokensMatch(order.customerEditToken, accessToken)) {
      throw new ApiError(403, "You are not authorized to pay this order.", "INVALID_ORDER_ACCESS");
    }
    if (order.status === "CANCELLED") {
      throw new ApiError(409, "A cancelled order cannot be paid.", "ORDER_CANCELLED");
    }
    if (order.paymentType !== "PAY_NOW") {
      throw new ApiError(
        409,
        "This order was created as Pay Later. Please pay through the cashier.",
        "PAY_LATER_ORDER"
      );
    }

    const existingPayment = await Payment.findOne({
      order: order._id,
      status: "PAID",
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .session(session)
      .lean<ExistingPayment>();

    const amount = Number(order.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "The order payment amount is invalid.", "INVALID_PAYMENT_AMOUNT");
    }

    const baseResult = {
      orderId: order._id.toString(),
      amount,
      paymentStatus: "PAID" as const,
      successUrl: `/payment/${order._id.toString()}/success`,
      receiptUrl: `/order/${order._id.toString()}/receipt`,
    };

    if (order.paymentStatus === "PAID" && existingPayment) {
      return {
        ...baseResult,
        paymentId: existingPayment._id.toString(),
        amount: Number(existingPayment.amount || amount),
        alreadyPaid: true,
      };
    }

    if (order.paymentStatus === "PAID") {
      throw new ApiError(
        409,
        "This order is marked paid, but its payment record is missing.",
        "PAYMENT_INTEGRITY_ERROR"
      );
    }

    const paidAt = new Date();
    const lockResult = await Order.updateOne(
      {
        _id: order._id,
        paymentType: "PAY_NOW",
        paymentStatus: { $ne: "PAID" },
        status: { $ne: "CANCELLED" },
      },
      {
        $set: { paymentStatus: "PAID" },
        $push: {
          statusHistory: {
            fromStatus: order.status,
            toStatus: order.status,
            changedBy: null,
            changedByName: "Customer",
            changedByRole: "CUSTOMER",
            note: "Customer completed mock online payment.",
            changedAt: paidAt,
          },
        },
      },
      { session }
    );

    if (lockResult.modifiedCount !== 1) {
      throw new ApiError(
        409,
        "This payment is already being processed or completed.",
        "PAYMENT_CONFLICT"
      );
    }

    const [payment] = await Payment.create(
      [
        {
          order: order._id,
          orders: [],
          diningSession: null,
          amount,
          method: "ONLINE",
          status: "PAID",
          paidAt,
          note: note || "Mock online payment",
        },
      ],
      { session }
    );

    await createAuditLog(
      {
        action: "ONLINE_PAYMENT_COMPLETED",
        module: "PAYMENTS",
        description: `Mock online payment completed for Order #${order._id
          .toString()
          .slice(-6)
          .toUpperCase()}. Amount: Rs. ${amount}.`,
        performedBy: "Customer",
        metadata: {
          orderId: order._id.toString(),
          paymentId: payment._id.toString(),
          amount,
          method: "ONLINE",
        },
      },
      { session, failClosed: true }
    );

    return {
      ...baseResult,
      paymentId: payment._id.toString(),
      alreadyPaid: false,
    };
  });
}
