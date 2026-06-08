import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/User";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type KitchenStatus = "ACCEPTED" | "PREPARING" | "READY";

const allowedKitchenStatuses: KitchenStatus[] = [
  "ACCEPTED",
  "PREPARING",
  "READY",
];

function isValidKitchenTransition(currentStatus: string, nextStatus: string) {
  const transitions: Record<string, string[]> = {
    PENDING: ["ACCEPTED"],
    ACCEPTED: ["PREPARING"],
    PREPARING: ["READY"],
    READY: [],
  };

  return transitions[currentStatus]?.includes(nextStatus) || false;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    const token = request.cookies.get("restaurant_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const authUser = verifyToken(token);

    if (authUser.role !== "KITCHEN_STAFF" && authUser.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Access denied",
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const { status, note = "" } = body as {
      status?: string;
      note?: string;
    };

    if (!status || !allowedKitchenStatuses.includes(status as KitchenStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid kitchen status",
        },
        { status: 400 }
      );
    }

    const order = await Order.findById(id).populate("table");

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    const orderDoc = order as any;

    if (!isValidKitchenTransition(orderDoc.status, status)) {
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

    if (status === "ACCEPTED") {
      orderDoc.acceptedAt = new Date();
    }

    if (status === "PREPARING") {
      orderDoc.preparingStartedAt = new Date();
    }

    if (status === "READY") {
      orderDoc.readyAt = new Date();
    }

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
      action: "KITCHEN_ORDER_UPDATED",
      module: "KITCHEN",
      description: `${authUser.name} changed Order #${orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase()} for ${tableName} from ${previousStatus} to ${status}.`,
    });
    await createAuditLog({
  action: "PAYMENT_SETTLED",
  module: "CASHIER",
  description: "...",
  performedBy: authUser.name,
});

    return NextResponse.json({
      success: true,
      message: "Kitchen order updated successfully",
      data: JSON.parse(JSON.stringify(orderDoc)),
    });
  } catch (error) {
    console.error("Kitchen order PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update kitchen order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}