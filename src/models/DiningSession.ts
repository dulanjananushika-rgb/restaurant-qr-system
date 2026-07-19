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

/*
 * A table can have only one OPEN dining session.
 *
 * After the session is closed, the same table
 * can create a new session for new customers.
 */
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

/*
 * Recompile during Next.js development so newly
 * added schema fields are immediately recognized.
 */
if (models.DiningSession) {
  delete models.DiningSession;
}

export default mongoose.model(
  "DiningSession",
  DiningSessionSchema
);