import mongoose, { Schema, models } from "mongoose";

const TableSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      default: 2,
      min: 1,
    },

    qrCode: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["AVAILABLE", "OCCUPIED", "RESERVED", "INACTIVE"],
      default: "AVAILABLE",
    },

    // Waiter assigned to this table
    // null means all waiters can handle this table
    assignedWaiter: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default models.Table || mongoose.model("Table", TableSchema);