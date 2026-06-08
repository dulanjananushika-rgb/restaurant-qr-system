import mongoose, { Schema, models } from "mongoose";

import "@/models/MenuItem";

const ComboOfferItemSchema = new Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const ComboOfferSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    items: {
      type: [ComboOfferItemSchema],
      required: true,
      validate: {
        validator(value: unknown[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Combo must have at least one menu item",
      },
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    offerPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default models.ComboOffer ||
  mongoose.model("ComboOffer", ComboOfferSchema);