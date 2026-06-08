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
  },
  { timestamps: true }
);

export default models.Table || mongoose.model("Table", TableSchema);