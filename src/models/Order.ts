import mongoose, { Schema, models } from "mongoose";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";
import "@/models/User";

/* =========================
   Normal menu item schema
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
   Combo offer item schema
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
   Main order schema
========================= */
const OrderSchema = new Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
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
     * Customer order edit token.
     * Customer can edit only their own order
     * before the kitchen accepts it.
     */
    customerEditToken: {
      type: String,
      default: "",
      select: false,
    },

    /*
     * Kept for old data compatibility.
     * Kitchen workflow may be team-based.
     */
    assignedChef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /*
     * Waiter who claimed and handles this order.
     * null means no waiter has claimed it yet.
     */
    assignedWaiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    /*
     * Time when the waiter claimed the order.
     */
    waiterClaimedAt: {
      type: Date,
      default: null,
    },

    /*
     * How the waiter received the order.
     *
     * PRIMARY:
     * Primary table waiter claimed within 4 minutes.
     *
     * BACKUP:
     * Another waiter claimed after the 4-minute timeout
     * or because the primary waiter was unavailable.
     *
     * SHARED:
     * Order came from an unassigned/shared table.
     */
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

    /*
     * Four-minute waiter response timer starts
     * from this time.
     */
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
 * Helpful index for waiter dashboard queries.
 */
OrderSchema.index({
  status: 1,
  assignedWaiter: 1,
  readyAt: 1,
  createdAt: -1,
});

/*
 * Next.js development server may keep an old
 * compiled Mongoose model. Recompile the model
 * so new fields are recognized.
 */
if (models.Order) {
  delete models.Order;
}

export default mongoose.model("Order", OrderSchema);