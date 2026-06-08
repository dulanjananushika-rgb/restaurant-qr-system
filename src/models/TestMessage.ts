import mongoose, { Schema, models } from "mongoose";

const TestMessageSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const TestMessage =
  models.TestMessage || mongoose.model("TestMessage", TestMessageSchema);

export default TestMessage;