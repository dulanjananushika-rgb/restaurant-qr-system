import mongoose, { Schema, models } from "mongoose";

const MenuItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default models.MenuItem || mongoose.model("MenuItem", MenuItemSchema);