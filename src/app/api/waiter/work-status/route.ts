import { NextRequest, NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import User from "@/models/User";

type WorkStatus =
  | "ON_DUTY"
  | "ON_BREAK"
  | "OFF_DUTY"
  | "ON_LEAVE";

const waiterSelectableStatuses: WorkStatus[] = [
  "ON_DUTY",
  "ON_BREAK",
  "OFF_DUTY",
];

async function getAuthenticatedWaiter(request: NextRequest) {
  const token = request.cookies.get("restaurant_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const authUser = verifyToken(token);

    if (authUser.role !== "WAITER") {
      return null;
    }

    await connectDB();

    const waiter = await User.findOne({
      _id: authUser.id,
      role: "WAITER",
      status: "ACTIVE",
    })
      .select(
        "_id name email role status workStatus workStatusUpdatedAt shiftStartedAt shiftEndedAt"
      )
      .lean();

    if (!waiter) {
      return null;
    }

    return {
      authUser,
      waiter,
    };
  } catch {
    return null;
  }
}

/*
 * GET
 * Return the logged-in waiter's current work status.
 */
export async function GET(request: NextRequest) {
  try {
    const authenticatedWaiter =
      await getAuthenticatedWaiter(request);

    if (!authenticatedWaiter) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized waiter account.",
        },
        {
          status: 401,
        }
      );
    }

    const { waiter } = authenticatedWaiter;

    const activeOrderCount = await Order.countDocuments({
      assignedWaiter: waiter._id,
      status: "PICKED_UP",
    });

    return NextResponse.json({
      success: true,

      data: {
        waiter: {
          _id: waiter._id,
          name: waiter.name,
          email: waiter.email,

          /*
           * Old waiter accounts may not have
           * workStatus stored in MongoDB yet.
           */
          workStatus:
            (waiter.workStatus as WorkStatus | undefined) ??
            "ON_DUTY",

          workStatusUpdatedAt:
            waiter.workStatusUpdatedAt ?? null,

          shiftStartedAt: waiter.shiftStartedAt ?? null,
          shiftEndedAt: waiter.shiftEndedAt ?? null,
        },

        activeOrderCount,
      },
    });
  } catch (error) {
    console.error("Waiter work status GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load waiter work status.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * PATCH
 *
 * Waiter actions:
 * ON_DUTY  → Start shift / return from break
 * ON_BREAK → Take a break
 * OFF_DUTY → End shift
 *
 * ON_LEAVE is controlled by the admin.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authenticatedWaiter =
      await getAuthenticatedWaiter(request);

    if (!authenticatedWaiter) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized waiter account.",
        },
        {
          status: 401,
        }
      );
    }

    const { waiter } = authenticatedWaiter;

    const body = (await request.json()) as {
      workStatus?: string;
    };

    const requestedStatus = body.workStatus as
      | WorkStatus
      | undefined;

    if (
      !requestedStatus ||
      !waiterSelectableStatuses.includes(requestedStatus)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid work status. Waiters can select ON_DUTY, ON_BREAK or OFF_DUTY.",
        },
        {
          status: 400,
        }
      );
    }

    const currentStatus =
      (waiter.workStatus as WorkStatus | undefined) ??
      "ON_DUTY";

    if (currentStatus === requestedStatus) {
      return NextResponse.json({
        success: true,
        message: `You are already ${requestedStatus}.`,

        data: {
          workStatus: currentStatus,
          workStatusUpdatedAt:
            waiter.workStatusUpdatedAt ?? null,
          shiftStartedAt: waiter.shiftStartedAt ?? null,
          shiftEndedAt: waiter.shiftEndedAt ?? null,
        },
      });
    }

    /*
     * A waiter cannot take a break or end the shift
     * while carrying an undelivered order.
     */
    if (
      requestedStatus === "ON_BREAK" ||
      requestedStatus === "OFF_DUTY"
    ) {
      const activeOrders = await Order.find({
        assignedWaiter: waiter._id,
        status: "PICKED_UP",
      })
        .select("_id table orderType")
        .limit(10)
        .lean();

      if (activeOrders.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "You still have an active picked-up order. Deliver or reassign it before changing your status.",
            activeOrderCount: activeOrders.length,
          },
          {
            status: 409,
          }
        );
      }
    }

    /*
     * Validate work status transitions.
     */
    if (
      requestedStatus === "ON_BREAK" &&
      currentStatus !== "ON_DUTY"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You must be ON_DUTY before taking a break.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      requestedStatus === "OFF_DUTY" &&
      currentStatus !== "ON_DUTY" &&
      currentStatus !== "ON_BREAK"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot end a shift from the current status.",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date();

    const updateFields: Record<string, unknown> = {
      workStatus: requestedStatus,
      workStatusUpdatedAt: now,
    };

    /*
     * Starting a new shift.
     */
    if (
      requestedStatus === "ON_DUTY" &&
      (currentStatus === "OFF_DUTY" ||
        currentStatus === "ON_LEAVE")
    ) {
      updateFields.shiftStartedAt = now;
      updateFields.shiftEndedAt = null;
    }

    /*
     * Returning from a break keeps the existing
     * shift start time.
     */
    if (
      requestedStatus === "ON_DUTY" &&
      currentStatus === "ON_BREAK"
    ) {
      updateFields.shiftEndedAt = null;
    }

    /*
     * Ending the current shift.
     */
    if (requestedStatus === "OFF_DUTY") {
      updateFields.shiftEndedAt = now;
    }

    const updatedWaiter = await User.findOneAndUpdate(
      {
        _id: waiter._id,
        role: "WAITER",
        status: "ACTIVE",
      },
      {
        $set: updateFields,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .select(
        "_id name email role status workStatus workStatusUpdatedAt shiftStartedAt shiftEndedAt"
      )
      .lean();

    if (!updatedWaiter) {
      return NextResponse.json(
        {
          success: false,
          message: "Waiter account could not be updated.",
        },
        {
          status: 404,
        }
      );
    }

    let message = "Work status updated successfully.";

    if (requestedStatus === "ON_DUTY") {
      message =
        currentStatus === "ON_BREAK"
          ? "You are back on duty."
          : "Your shift has started.";
    }

    if (requestedStatus === "ON_BREAK") {
      message =
        "You are now on break. New orders will go to backup waiters.";
    }

    if (requestedStatus === "OFF_DUTY") {
      message =
        "Your shift has ended. New orders will go to backup waiters.";
    }

    return NextResponse.json({
      success: true,
      message,

      data: {
        workStatus: updatedWaiter.workStatus,
        workStatusUpdatedAt:
          updatedWaiter.workStatusUpdatedAt,
        shiftStartedAt: updatedWaiter.shiftStartedAt,
        shiftEndedAt: updatedWaiter.shiftEndedAt,
      },
    });
  } catch (error) {
    console.error("Waiter work status PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update waiter work status.",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}