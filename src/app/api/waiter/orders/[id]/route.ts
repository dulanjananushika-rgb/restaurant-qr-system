import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import Table from "@/models/Table";
import "@/models/User";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type WaiterStatus = "PICKED_UP" | "DELIVERED";

const allowedWaiterStatuses: WaiterStatus[] = ["PICKED_UP", "DELIVERED"];

function isValidWaiterTransition(currentStatus: string, nextStatus: string) {
  const transitions: Record<string, string[]> = {
    READY: ["PICKED_UP"],
    PICKED_UP: ["DELIVERED"],
    DELIVERED: [],
  };
  return transitions[currentStatus]?.includes(nextStatus) || false;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    const token = request.cookies.get("restaurant_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const authUser = verifyToken(token);

    if (authUser.role !== "WAITER" && authUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, note = "" } = body as {
      status?: string;
      note?: string;
    };

    if (!status || !allowedWaiterStatuses.includes(status as WaiterStatus)) {
      return NextResponse.json(
        { success: false, message: "Invalid waiter status" },
        { status: 400 }
      );
    }

    const order = await Order.findById(id).populate("table");

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      );
    }

    const orderDoc = order as any;

    if (!isValidWaiterTransition(orderDoc.status, status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot change order from ${orderDoc.status} to ${status}`,
        },
        { status: 400 }
      );
    }

    const previousStatus = orderDoc.status;
    orderDoc.status = status;

    // Set timestamps
    if (status === "PICKED_UP") {
      orderDoc.pickedUpAt = new Date();
    }

    if (status === "DELIVERED") {
      orderDoc.deliveredAt = new Date();

      // ==================== TABLE STATUS UPDATE ====================
      if (orderDoc.table && orderDoc.table._id) {
        // PAY_NOW නම් Delivered වුණාම table එක release කරනවා
        if (orderDoc.paymentType === "PAY_NOW") {
          await Table.findByIdAndUpdate(orderDoc.table._id, {
            status: "AVAILABLE",
          });
        }
        // PAY_LATER නම් table එක තවම OCCUPIED විදිහට තියාගන්නවා
      }
      // ============================================================
    }

    // Status History
    if (!Array.isArray(orderDoc.statusHistory)) {
      orderDoc.statusHistory = [];
    }

    orderDoc.statusHistory.push({
      fromStatus: previousStatus,
      toStatus: status,
      changedBy: authUser.id,
      changedByName: authUser.name,
      changedByRole: authUser.role,
      note,
      changedAt: new Date(),
    });

    await orderDoc.save();

    const tableName =
      orderDoc.table && typeof orderDoc.table === "object" && orderDoc.table.name
        ? String(orderDoc.table.name)
        : "Unknown table";

    await createAuditLog({
      action: "WAITER_ORDER_UPDATED",
      module: "WAITER",
      description: `${authUser.name} changed Order #${orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase()} for ${tableName} from ${previousStatus} to ${status}.`,
    });

    return NextResponse.json({
      success: true,
      message: "Waiter order updated successfully",
      data: JSON.parse(JSON.stringify(orderDoc)),
    });
  } catch (error) {
    console.error("Waiter order PATCH error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update waiter order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}