import mongoose, { Schema, models } from "mongoose";

import "@/models/Order";
import "@/models/DiningSession";

const PaymentSchema = new Schema(
  {
    /*
     * Used for takeaway orders and older
     * single-order payment records.
     */
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    /*
     * Used when several dine-in orders are
     * settled using one combined table bill.
     */
    orders: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
          required: true,
        },
      ],
      default: [],
    },

    /*
     * Dining session connected to the
     * combined table bill.
     *
     * Takeaway and legacy payments use null.
     */
    diningSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiningSession",
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0.01, "Payment amount must be greater than zero."],
    },

    method: {
      type: String,
      enum: ["CASH", "CARD", "ONLINE"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PAID", "FAILED", "REFUNDED"],
      default: "PAID",
      index: true,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * A payment must be connected to:
 *
 * 1. One order using payment.order
 *
 * OR
 *
 * 2. One or more orders using payment.orders
 *
 * Mongoose 9 pre middleware does not use next().
 */
PaymentSchema.pre("validate", function () {
  const payment = this as mongoose.Document & {
    order?: mongoose.Types.ObjectId | null;
    orders?: mongoose.Types.ObjectId[];
  };

  const hasSingleOrder = Boolean(payment.order);

  const hasCombinedOrders =
    Array.isArray(payment.orders) &&
    payment.orders.length > 0;

  if (!hasSingleOrder && !hasCombinedOrders) {
    payment.invalidate(
      "order",
      "A payment must contain at least one order."
    );
  }

  /*
   * Remove duplicate order IDs from a combined payment.
   */
  if (hasCombinedOrders && payment.orders) {
    const uniqueOrderIds = [
      ...new Set(
        payment.orders.map((orderId) =>
          orderId.toString()
        )
      ),
    ];

    payment.orders = uniqueOrderIds.map(
      (orderId) =>
        new mongoose.Types.ObjectId(orderId)
    );
  }
});

/*
 * Helpful indexes for payment history
 * and dining-session payment searches.
 */
PaymentSchema.index({
  diningSession: 1,
  status: 1,
  paidAt: -1,
});

PaymentSchema.index({
  order: 1,
  status: 1,
});

PaymentSchema.index({
  orders: 1,
  status: 1,
});

/*
 * Reuse the compiled model in Next.js.
 */
const Payment =
  models.Payment ||
  mongoose.model("Payment", PaymentSchema);

export default Payment;