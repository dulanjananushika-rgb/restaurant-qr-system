import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

export async function GET() {
  try {
    await connectDB();

    const orders = await Order.find({
      status: {
        $in: ["PENDING", "ACCEPTED", "PREPARING", "READY"],
      },
    })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean();

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Kitchen orders GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load kitchen orders",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
      
    );

  }
}