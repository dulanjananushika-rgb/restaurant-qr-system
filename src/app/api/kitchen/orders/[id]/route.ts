import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/User";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    PICKED_UP: [],
    DELIVERED: [],
    CANCELLED: [],
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
          message: `This order is already ${orderDoc.status}. Please refresh the kitchen screen.`,
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

    const orderLocation =
      orderDoc.orderType === "TAKE_AWAY"
        ? "Counter pickup"
        : orderDoc.table &&
            typeof orderDoc.table === "object" &&
            orderDoc.table.name
          ? String(orderDoc.table.name)
          : "Unknown table";

    await createAuditLog({
      action: "KITCHEN_ORDER_UPDATED",
      module: "KITCHEN",
      description: `${authUser.name} changed Order #${orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase()} for ${orderLocation} from ${previousStatus} to ${status}.`,
      performedBy: authUser.name,
      metadata: {
        orderId: orderDoc._id.toString(),
        fromStatus: previousStatus,
        toStatus: status,
        orderType: orderDoc.orderType || "DINE_IN",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Kitchen order updated successfully",
      data: {
        orderId: orderDoc._id.toString(),
        status: orderDoc.status,
      },
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