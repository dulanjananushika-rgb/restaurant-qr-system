import mongoose, { Schema, models } from "mongoose";

const SupplierSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  { timestamps: true }
);

export default models.Supplier || mongoose.model("Supplier", SupplierSchema);