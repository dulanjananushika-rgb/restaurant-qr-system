import mongoose, { Schema, models } from "mongoose";

import "@/models/Table";

const DiningSessionSchema = new Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID"],
      default: "UNPAID",
      index: true,
    },

    openedAt: {
      type: Date,
      default: Date.now,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

DiningSessionSchema.index(
  {
    table: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "OPEN",
    },
  }
);

export default models.DiningSession || mongoose.model("DiningSession", DiningSessionSchema);