import mongoose, { Schema, models } from "mongoose";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";
import "@/models/User";

const OrderItemSchema = new Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const OrderComboItemSchema = new Schema(
  {
    comboOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ComboOffer",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    comboItemsSnapshot: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },

        name: {
          type: String,
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
    ],
  },
  { _id: true }
);

const OrderStatusHistorySchema = new Schema(
  {
    fromStatus: {
      type: String,
      default: "",
    },

    toStatus: {
      type: String,
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    changedByName: {
      type: String,
      default: "",
      trim: true,
    },

    changedByRole: {
      type: String,
      default: "",
      trim: true,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const OrderSchema = new Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      default: null,
    },

    orderType: {
      type: String,
      enum: ["DINE_IN", "TAKE_AWAY", "ONLINE"],
      default: "DINE_IN",
    },

    customerName: {
      type: String,
      default: "",
      trim: true,
    },

    customerPhone: {
      type: String,
      default: "",
      trim: true,
    },

    items: {
      type: [OrderItemSchema],
      default: [],
    },

    comboItems: {
      type: [OrderComboItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "PICKED_UP",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PENDING", "PAID", "FAILED", "PARTIALLY_PAID"],
      default: "UNPAID",
    },

    paymentType: {
      type: String,
      enum: ["PAY_NOW", "PAY_LATER"],
      default: "PAY_LATER",
    },

    /*
      Customer order edit token.
      This allows the customer to edit only their own order before kitchen acceptance.
      select: false means it will not be returned by normal queries.
    */
    customerEditToken: {
      type: String,
      default: "",
      select: false,
    },

    /*
      Kept for old data compatibility.
      Current final kitchen flow is team-based, not chef-assigned.
    */
    assignedChef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    preparingStartedAt: {
      type: Date,
      default: null,
    },

    readyAt: {
      type: Date,
      default: null,
    },

    pickedUpAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    statusHistory: {
      type: [OrderStatusHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

/*
  IMPORTANT:
  Next.js dev server + Mongoose sometimes keeps the old compiled model.
  This forces Order model to recompile with new fields like customerEditToken.
*/
if (models.Order) {
  delete models.Order;
}

export default mongoose.model("Order", OrderSchema);