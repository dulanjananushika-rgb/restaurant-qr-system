import mongoose, { Schema, models } from "mongoose";

import "@/models/Supplier";
import "@/models/InventoryItem";

const PurchaseItemSchema = new Schema(
  {
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },

    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const PurchaseSchema = new Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    invoiceNumber: {
      type: String,
      default: "",
      trim: true,
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    items: {
      type: [PurchaseItemSchema],
      required: true,
      validate: {
        validator(value: unknown[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Purchase must have at least one item",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID", "PARTIALLY_PAID"],
      default: "UNPAID",
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

export default models.Purchase || mongoose.model("Purchase", PurchaseSchema);