import mongoose, { Schema, models } from "mongoose";

import "@/models/Order";

const PaymentSchema = new Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
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
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export default models.Payment || mongoose.model("Payment", PaymentSchema);