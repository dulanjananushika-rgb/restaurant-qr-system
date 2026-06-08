import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import InventoryItem from "@/models/InventoryItem";

// Important: populate("table") wada karanna Table model eka register wenna one
import "@/models/Table";

export async function GET() {
  try {
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paidOrders = await Order.find({
      paymentStatus: "PAID",
      createdAt: { $gte: today },
    });

    const todayRevenue = paidOrders.reduce(
      (sum, order) => sum + (order.totalAmount || 0),
      0
    );

    const activeOrders = await Order.countDocuments({
      status: { $in: ["PENDING", "ACCEPTED", "PREPARING"] },
    });

    const readyOrders = await Order.countDocuments({
      status: "READY",
    });

    const lowStockItems = await InventoryItem.find({
      $expr: { $lte: ["$quantity", "$minQuantity"] },
    });

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("table")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue,
        activeOrders,
        readyOrders,
        lowStockCount: lowStockItems.length,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load dashboard data",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}