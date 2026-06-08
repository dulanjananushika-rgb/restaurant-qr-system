import mongoose, { Schema, models } from "mongoose";

const AuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },

    module: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    performedBy: {
      type: String,
      default: "System",
      trim: true,
    },

    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

export default models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);