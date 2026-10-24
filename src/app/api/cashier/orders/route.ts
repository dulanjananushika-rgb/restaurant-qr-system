import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["CASHIER", "ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const orders = await Order.find({
      paymentStatus: { $in: ["UNPAID", "PENDING", "PARTIALLY_PAID"] },
      status: { $in: ["DELIVERED", "READY", "PICKED_UP"] },
    })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .lean();

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Cashier orders GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load cashier orders",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
