import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";
import "@/models/User";

export async function GET() {
  try {
    await connectDB();

    const orders = await Order.find({
      status: {
        $in: ["READY", "PICKED_UP", "DELIVERED"],
      },
    })
      .sort({ createdAt: -1 })
      .populate("table")
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
      { status: 500 }
    );
  }
}