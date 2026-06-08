import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import "@/models/Table";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
];

const allowedPaymentStatuses = [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "PARTIALLY_PAID",
];

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const { status, paymentStatus } = body as {
      status?: string;
      paymentStatus?: string;
    };

    const updateData: {
      status?: string;
      paymentStatus?: string;
    } = {};

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid order status",
          },
          { status: 400 }
        );
      }

      updateData.status = status;
    }

    if (paymentStatus) {
      if (!allowedPaymentStatuses.includes(paymentStatus)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid payment status",
          },
          { status: 400 }
        );
      }

      updateData.paymentStatus = paymentStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid update data provided",
        },
        { status: 400 }
      );
    }

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
    })
      .populate("table")
      .lean();

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found",
        },
        { status: 404 }
      );
    }

    const tableName =
      typeof order.table === "object" && order.table && "name" in order.table
        ? String(order.table.name)
        : "Unknown table";

    const updatedParts = [
      status ? `Status changed to ${status}` : "",
      paymentStatus ? `Payment status changed to ${paymentStatus}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    await createAuditLog({
      action: "ORDER_UPDATED",
      module: "ADMIN_ORDERS",
      description: `Order #${id
        .slice(-6)
        .toUpperCase()} updated for ${tableName}. ${updatedParts}.`,
    });

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Admin order update error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update order",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}