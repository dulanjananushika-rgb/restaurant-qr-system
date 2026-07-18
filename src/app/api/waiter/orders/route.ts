import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import Table from "@/models/Table";
import User from "@/models/User";

import "@/models/MenuItem";
import "@/models/ComboOffer";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Get the logged-in user's token
    const token = request.cookies.get("restaurant_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in.",
        },
        {
          status: 401,
        }
      );
    }

    // Verify token
    let authUser;

    try {
      authUser = verifyToken(token);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired login session.",
        },
        {
          status: 401,
        }
      );
    }

    // Only WAITER and ADMIN users can access this API
    if (authUser.role !== "WAITER" && authUser.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Access denied.",
        },
        {
          status: 403,
        }
      );
    }

    // Check that the user account still exists and is active
    const activeUser = await User.findOne({
      _id: authUser.id,
      role: authUser.role,
      status: "ACTIVE",
    })
      .select("_id name email role status")
      .lean();

    if (!activeUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is inactive or unavailable.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ADMIN:
     * Can see all READY, PICKED_UP and DELIVERED orders.
     *
     * WAITER:
     * Can see:
     * 1. Orders from tables assigned to that waiter
     * 2. Orders from shared/unassigned tables
     * 3. Takeaway or online orders without a table
     */

    if (authUser.role === "ADMIN") {
      const orders = await Order.find({
        status: {
          $in: ["READY", "PICKED_UP", "DELIVERED"],
        },
      })
        .sort({
          createdAt: -1,
        })
        .populate({
          path: "table",
          populate: {
            path: "assignedWaiter",
            select: "name email role status",
          },
        })
        .populate("assignedChef")
        .populate("items.menuItem")
        .populate("comboItems.comboOffer")
        .lean();

      return NextResponse.json({
        success: true,
        data: orders,
      });
    }

    // Find tables accessible by the logged-in waiter
    const accessibleTables = await Table.find({
      $or: [
        {
          assignedWaiter: authUser.id,
        },
        {
          assignedWaiter: null,
        },
        {
          assignedWaiter: {
            $exists: false,
          },
        },
      ],
    })
      .select("_id")
      .lean();

    const accessibleTableIds = accessibleTables.map((table) => table._id);

    const orders = await Order.find({
      status: {
        $in: ["READY", "PICKED_UP", "DELIVERED"],
      },

      $or: [
        // Orders from assigned or shared tables
        {
          table: {
            $in: accessibleTableIds,
          },
        },

        // Takeaway or online orders without a table
        {
          table: null,
        },

        // Support old orders where table field does not exist
        {
          table: {
            $exists: false,
          },
        },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .populate({
        path: "table",
        populate: {
          path: "assignedWaiter",
          select: "name email role status",
        },
      })
      .populate("assignedChef")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean();

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Waiter orders GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load waiter orders",
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      }
    );
  }
}