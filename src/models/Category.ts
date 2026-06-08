import mongoose, { Schema, models } from "mongoose";

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

export default models.Category ||
  mongoose.model("Category", CategorySchema);