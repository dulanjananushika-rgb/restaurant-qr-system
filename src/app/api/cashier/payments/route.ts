import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { verifyToken } from "@/lib/auth";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import Table from "@/models/Table";

export async function POST(request: NextRequest) {
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

    if (authUser.role !== "CASHIER" && authUser.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Access denied",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { orderId, method, amount, note = "" } = body as {
      orderId?: string;
      method?: "CASH" | "CARD" | "ONLINE";
      amount?: number;
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

    if (!method || !["CASH", "CARD", "ONLINE"].includes(method)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid payment method is required",
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

    const payableAmount = Number(amount || orderDoc.totalAmount || 0);

    if (payableAmount <= 0) {
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
      amount: payableAmount,
      method,
      status: "PAID",
      paidAt: new Date(),
      note,
    });

    orderDoc.paymentStatus = "PAID";
    orderDoc.paymentType = orderDoc.paymentType || "PAY_LATER";

    if (!Array.isArray(orderDoc.statusHistory)) {
      orderDoc.statusHistory = [];
    }

    orderDoc.statusHistory.push({
      fromStatus: orderDoc.paymentStatus,
      toStatus: "PAYMENT_PAID",
      changedBy: authUser.id,
      changedByName: authUser.name,
      changedByRole: authUser.role,
      note: `Payment settled by ${method}${note ? ` - ${note}` : ""}`,
      changedAt: new Date(),
    });

    await orderDoc.save();

    /*
      Real restaurant logic:
      If the order is delivered and paid, table can be released.
      If order is not delivered yet, keep table occupied.
    */
    if (orderDoc.table && orderDoc.status === "DELIVERED") {
      await Table.findByIdAndUpdate(orderDoc.table._id, {
        status: "AVAILABLE",
      });
    }

    const tableName =
      orderDoc.table && typeof orderDoc.table === "object" && orderDoc.table.name
        ? String(orderDoc.table.name)
        : "Unknown table";

    await createAuditLog({
      action: "PAYMENT_SETTLED",
      module: "CASHIER",
      description: `${authUser.name} settled payment for Order #${orderDoc._id
        .toString()
        .slice(-6)
        .toUpperCase()} (${tableName}) using ${method}. Amount: Rs. ${payableAmount}.`,
    });
    

    return NextResponse.json(
      {
        success: true,
        message: "Payment settled successfully",
        data: {
          paymentId: payment._id.toString(),
          orderId: orderDoc._id.toString(),
          amount: payableAmount,
          method,
          paymentStatus: orderDoc.paymentStatus,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Cashier payment POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to settle payment",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}