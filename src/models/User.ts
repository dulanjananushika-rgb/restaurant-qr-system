import mongoose, { Schema, models } from "mongoose";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "ADMIN",
        "KITCHEN_STAFF",
        "WAITER",
        "CASHIER",
      ],
      default: "WAITER",
      index: true,
    },

    /*
     * Account access status.
     * INACTIVE users cannot log in or use protected APIs.
     */
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },

    /*
     * Current waiter availability.
     *
     * ON_DUTY:
     * Can receive and claim new orders.
     *
     * ON_BREAK:
     * Cannot receive new primary orders.
     * Assigned table orders go immediately
     * to the backup waiter queue.
     *
     * OFF_DUTY:
     * Shift has finished or waiter has not arrived.
     *
     * ON_LEAVE:
     * Waiter is absent for the day or longer.
     */
    workStatus: {
      type: String,
      enum: [
        "ON_DUTY",
        "ON_BREAK",
        "OFF_DUTY",
        "ON_LEAVE",
      ],
      default: "ON_DUTY",
      index: true,
    },

    /*
     * Records when the waiter work status
     * was last changed.
     */
    workStatusUpdatedAt: {
      type: Date,
      default: Date.now,
    },

    /*
     * Records when the current shift started.
     */
    shiftStartedAt: {
      type: Date,
      default: null,
    },

    /*
     * Records when the current shift ended.
     */
    shiftEndedAt: {
      type: Date,
      default: null,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Useful when loading available waiters.
 */
UserSchema.index({
  role: 1,
  status: 1,
  workStatus: 1,
});

/*
 * Recompile the Mongoose model during
 * Next.js development after schema changes.
 */
if (models.User) {
  delete models.User;
}

export default mongoose.model("User", UserSchema);