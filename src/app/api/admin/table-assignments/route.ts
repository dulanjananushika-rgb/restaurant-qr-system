import mongoose from "mongoose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";

import Table from "@/models/Table";
import User from "@/models/User";

type AssignmentBody = {
  tableId?: string;
  tableIds?: string[];
  waiterId?: string | null;
};

async function getActiveAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("restaurant_token")?.value;

    if (!token) {
      return null;
    }

    const authUser = verifyToken(token);

    if (authUser.role !== "ADMIN") {
      return null;
    }

    await connectDB();

    const admin = await User.findOne({
      _id: authUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    })
      .select("_id name email role status")
      .lean();

    return admin ? authUser : null;
  } catch {
    return null;
  }
}

/*
 * GET
 * Load all tables and active waiters.
 */
export async function GET() {
  try {
    const adminUser = await getActiveAdmin();

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Active admin access is required.",
        },
        {
          status: 401,
        }
      );
    }

    const [tables, waiters] = await Promise.all([
      Table.find()
        .populate({
          path: "assignedWaiter",
          select: "name email role status",
        })
        .sort({
          createdAt: 1,
        })
        .lean(),

      User.find({
        role: "WAITER",
        status: "ACTIVE",
      })
        .select("_id name email role status")
        .sort({
          name: 1,
        })
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tables,
        waiters,
      },
    });
  } catch (error) {
    console.error("Table assignment GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load table assignments.",
        error: error instanceof Error ? error.message : String(error),
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
 * Single assignment:
 * {
 *   tableId: "...",
 *   waiterId: "..."
 * }
 *
 * Bulk/range assignment:
 * {
 *   tableIds: ["...", "...", "..."],
 *   waiterId: "..."
 * }
 *
 * waiterId null means Shared — All waiters.
 */
export async function PATCH(request: Request) {
  try {
    const adminUser = await getActiveAdmin();

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Active admin access is required.",
        },
        {
          status: 401,
        }
      );
    }

    const body = (await request.json()) as AssignmentBody;

    const { tableId, tableIds, waiterId } = body;

    /*
     * Support both:
     * - one tableId
     * - multiple tableIds
     */
    const requestedTableIds = Array.isArray(tableIds)
      ? tableIds
      : tableId
        ? [tableId]
        : [];

    /*
     * Remove duplicate IDs.
     */
    const uniqueTableIds = [
      ...new Set(
        requestedTableIds.filter(
          (id): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      ),
    ];

    if (uniqueTableIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one table must be selected.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Avoid accidental very large updates.
     */
    if (uniqueTableIds.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "You can update a maximum of 100 tables at once.",
        },
        {
          status: 400,
        }
      );
    }

    const invalidTableId = uniqueTableIds.find(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );

    if (invalidTableId) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more selected table IDs are invalid.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Make sure all selected tables exist.
     */
    const existingTables = await Table.find({
      _id: {
        $in: uniqueTableIds,
      },
    })
      .select("_id name")
      .lean();

    if (existingTables.length !== uniqueTableIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more selected tables were not found.",
        },
        {
          status: 404,
        }
      );
    }

    let selectedWaiterId: mongoose.Types.ObjectId | null = null;
    let selectedWaiterName = "Shared — All waiters";

    /*
     * Empty or null waiterId means shared tables.
     */
    if (
      typeof waiterId === "string" &&
      waiterId.trim().length > 0
    ) {
      if (!mongoose.Types.ObjectId.isValid(waiterId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid waiter ID.",
          },
          {
            status: 400,
          }
        );
      }

      const waiter = await User.findOne({
        _id: waiterId,
        role: "WAITER",
        status: "ACTIVE",
      })
        .select("_id name email")
        .lean();

      if (!waiter) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected active waiter was not found.",
          },
          {
            status: 404,
          }
        );
      }

      selectedWaiterId = new mongoose.Types.ObjectId(waiterId);
      selectedWaiterName = waiter.name;
    }

    /*
     * Update all selected tables together.
     */
    const updateResult = await Table.updateMany(
      {
        _id: {
          $in: uniqueTableIds,
        },
      },
      {
        $set: {
          assignedWaiter: selectedWaiterId,
        },
      },
      {
        runValidators: true,
      }
    );

    /*
     * Return the updated table list.
     */
    const updatedTables = await Table.find({
      _id: {
        $in: uniqueTableIds,
      },
    })
      .populate({
        path: "assignedWaiter",
        select: "name email role status",
      })
      .sort({
        createdAt: 1,
      })
      .lean();

    const assignmentType =
      uniqueTableIds.length === 1 ? "Table" : "Tables";

    return NextResponse.json({
      success: true,
      message:
        `${uniqueTableIds.length} ${assignmentType.toLowerCase()} ` +
        `assigned to ${selectedWaiterName} successfully.`,
      data: {
        updatedTables,
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Table assignment PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update table assignments.",
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      }
    );
  }
}