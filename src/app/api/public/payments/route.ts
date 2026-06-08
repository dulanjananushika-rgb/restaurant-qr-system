import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Order from "@/models/Order";
import Payment from "@/models/Payment";

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const { orderId, method = "ONLINE", note = "Mock online payment" } = body as {
      orderId?: string;
      method?: "ONLINE";
      note?: string;
    };

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          message: "Order is required",
        },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId).populate("table");

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

    if (orderDoc.paymentStatus === "PAID") {
      return NextResponse.json(
        {
          success: false,
          message: "This order is already paid",
        },
        { status: 400 }
      );
    }

    if (orderDoc.paymentType !== "PAY_NOW") {
      return NextResponse.json(
        {
          success: false,
          message: "This order is not a Pay Now order",
        },
        { status: 400 }
      );
    }

    const amount = Number(orderDoc.totalAmount || 0);

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment amount",
        },
        { status: 400 }
      );
    }

    const payment = await Payment.create({
      order: orderDoc._id,
      amount,
      method,
      status: "PAID",
      paidAt: new Date(),
      note,
    });

    orderDoc.paymentStatus = "PAID";

    if (!Array.isArray(orderDoc.statusHistory)) {
      orderDoc.statusHistory = [];
    }

    orderDoc.statusHistory.push({
      fromStatus: "PENDING",
      toStatus: "PAYMENT_PAID",
      changedByName: "Customer",
      changedByRole: "CUSTOMER",
      note: "Customer completed mock online payment",
      changedAt: new Date(),
    });

    await orderDoc.save();

    const tableName =
      orderDoc.table && typeof orderDoc.table === "object" && orderDoc.table.name
        ? String(orderDoc.table.name)
        : "Unknown table";

    await createAuditLog({
      action: "ONLINE_PAYMENT_COMPLETED",
      module: "PAYMENTS",
      description: `Mock online payment completed for Order #${orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase()} (${tableName}). Amount: Rs. ${amount}.`,
      performedBy: "Customer",
    });

    return NextResponse.json({
      success: true,
      message: "Payment completed successfully",
      data: {
        paymentId: payment._id.toString(),
        orderId: orderDoc._id.toString(),
        amount,
        paymentStatus: orderDoc.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Public payment POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to complete payment",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}