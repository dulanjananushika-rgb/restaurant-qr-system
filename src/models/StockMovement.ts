import mongoose, { Schema, models } from "mongoose";

import "@/models/InventoryItem";
import "@/models/Order";

const StockMovementSchema = new Schema(
  {
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },

    type: {
      type: String,
      enum: ["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "ORDER_DEDUCTION"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    previousQuantity: {
      type: Number,
      required: true,
    },

    newQuantity: {
      type: Number,
      required: true,
    },

    reason: {
      type: String,
      default: "",
      trim: true,
    },

    referenceType: {
      type: String,
      enum: ["MANUAL", "ORDER", "SYSTEM"],
      default: "MANUAL",
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

export default models.StockMovement ||
  mongoose.model("StockMovement", StockMovementSchema);