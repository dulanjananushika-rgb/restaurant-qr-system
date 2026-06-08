import mongoose, { Schema, models } from "mongoose";

const InventoryItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      enum: ["kg", "g", "pcs", "L", "ml"],
      default: "kg",
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    minQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

export default models.InventoryItem ||
  mongoose.model("InventoryItem", InventoryItemSchema);