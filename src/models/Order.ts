import mongoose, { Schema, models } from "mongoose";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";
import "@/models/User";
import "@/models/DiningSession";

/* =========================
   Normal order menu item
========================= */

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
  {
    _id: true,
  }
);

/* =========================
   Combo item snapshot
========================= */

const ComboItemSnapshotSchema = new Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
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
  {
    _id: false,
  }
);

/* =========================
   Ordered combo item
========================= */

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

    comboItemsSnapshot: {
      type: [ComboItemSnapshotSchema],
      default: [],
    },
  },
  {
    _id: true,
  }
);

/* =========================
   Order status history
========================= */

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
      maxlength: 500,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

/* =========================
   Main Order schema
========================= */

const OrderSchema = new Schema(
  {
    /*
     * Dine-in orders have a table.
     * Takeaway orders use table = null.
     */
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      default: null,
      index: true,
    },

    /*
     * All orders placed during one table visit
     * are connected to the same dining session.
     *
     * Takeaway orders use diningSession = null.
     */
    diningSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiningSession",
      default: null,
      index: true,
    },

    orderType: {
      type: String,
      enum: ["DINE_IN", "TAKE_AWAY", "ONLINE"],
      default: "DINE_IN",
      index: true,
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
      index: true,
    },

    paymentStatus: {
      type: String,

      enum: [
        "UNPAID",
        "PENDING",
        "PAID",
        "FAILED",
        "PARTIALLY_PAID",
      ],

      default: "UNPAID",
      index: true,
    },

    paymentType: {
      type: String,
      enum: ["PAY_NOW", "PAY_LATER"],
      default: "PAY_LATER",
    },

    /*
     * Used to allow customers to edit or cancel
     * only their own pending order.
     */
    customerEditToken: {
      type: String,
      default: "",
      select: false,
    },

    assignedChef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
     * Waiter who claimed this specific order.
     *
     * This can be different from the table's
     * primary assigned waiter.
     */
    assignedWaiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    waiterClaimedAt: {
      type: Date,
      default: null,
    },

    waiterClaimType: {
      type: String,
      enum: ["PRIMARY", "BACKUP", "SHARED"],
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
  {
    timestamps: true,
  }
);

/*
 * Helpful indexes for cashier, waiter and
 * dining-session queries.
 */
OrderSchema.index({
  diningSession: 1,
  paymentStatus: 1,
  status: 1,
  createdAt: 1,
});

OrderSchema.index({
  status: 1,
  assignedWaiter: 1,
  readyAt: 1,
  createdAt: -1,
});

if (models.Order) {
  delete models.Order;
}

export default mongoose.model("Order", OrderSchema);