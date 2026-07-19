import mongoose from "mongoose";

import "@/models/InventoryItem";
import "@/models/Order";

const { Schema, models } = mongoose;

const StockMovementSchema = new Schema(
  {
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },

    type: {
      type: String,

      enum: [
        "STOCK_IN",
        "STOCK_OUT",
        "ADJUSTMENT",
        "ORDER_DEDUCTION",
      ],

      required: true,
      index: true,
    },

    /*
     * STOCK_IN:
     * Positive quantity
     *
     * STOCK_OUT / ORDER_DEDUCTION:
     * Negative quantity
     */
    quantity: {
      type: Number,
      required: true,
    },

    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    /*
     * Identifies the operation that created
     * this stock movement.
     */
    referenceType: {
      type: String,

      enum: [
        "MANUAL",
        "ORDER",
        "PURCHASE",
        "SYSTEM",
      ],

      default: "MANUAL",
      index: true,
    },

    /*
     * Can store an Order ID, Purchase ID,
     * or another connected document ID.
     */
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Helpful index for inventory history.
 */
StockMovementSchema.index({
  inventoryItem: 1,
  createdAt: -1,
});

/*
 * Reuse the existing compiled model in Next.js.
 */
const StockMovement =
  models.StockMovement ||
  mongoose.model(
    "StockMovement",
    StockMovementSchema
  );

export default StockMovement;