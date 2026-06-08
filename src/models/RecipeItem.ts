import mongoose, { Schema, models } from "mongoose";

import "@/models/MenuItem";
import "@/models/InventoryItem";

const RecipeItemSchema = new Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    requiredQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

export default models.RecipeItem ||
  mongoose.model("RecipeItem", RecipeItemSchema);