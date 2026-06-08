import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import InventoryItem from "@/models/InventoryItem";
import "@/models/Table";
import "@/models/MenuItem";

export async function GET() {
  try {
    await connectDB();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      orders,
      todayOrders,
      paidOrders,
      unpaidOrders,
      lowStockItems,
      recentOrders,
      recentPayments,
    ] = await Promise.all([
      Order.find().populate("table").populate("items.menuItem").lean(),

      Order.find({
        createdAt: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      })
        .populate("table")
        .populate("items.menuItem")
        .lean(),

      Order.find({ paymentStatus: "PAID" })
        .populate("table")
        .populate("items.menuItem")
        .lean(),

      Order.find({
        paymentStatus: { $in: ["UNPAID", "PENDING", "PARTIALLY_PAID"] },
      })
        .populate("table")
        .populate("items.menuItem")
        .lean(),

      InventoryItem.find({
        $expr: {
          $lte: ["$quantity", "$minQuantity"],
        },
      })
        .sort({ quantity: 1 })
        .lean(),

      Order.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("table")
        .populate("items.menuItem")
        .lean(),

      Order.find({ paymentStatus: "PAID" })
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate("table")
        .populate("items.menuItem")
        .lean(),
    ]);

    const todayRevenue = todayOrders
      .filter((order) => order.paymentStatus === "PAID")
      .reduce((sum, order) => sum + order.totalAmount, 0);

    const totalRevenue = paidOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );

    const topSellingMap = new Map<
      string,
      {
        menuItemId: string;
        name: string;
        quantity: number;
        revenue: number;
      }
    >();

    for (const order of orders) {
      for (const item of order.items || []) {
        const menuItem = item.menuItem as any;

        if (!menuItem?._id) continue;

        const menuItemId = menuItem._id.toString();
        const existing = topSellingMap.get(menuItemId);

        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.price * item.quantity;
        } else {
          topSellingMap.set(menuItemId, {
            menuItemId,
            name: menuItem.name || "Menu item",
            quantity: item.quantity,
            revenue: item.price * item.quantity,
          });
        }
      }
    }

    const topSellingItems = Array.from(topSellingMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        cards: {
          todayRevenue,
          totalRevenue,
          totalOrders: orders.length,
          todayOrders: todayOrders.length,
          paidOrders: paidOrders.length,
          unpaidOrders: unpaidOrders.length,
          lowStockItems: lowStockItems.length,
        },
        topSellingItems,
        lowStockItems,
        recentOrders,
        recentPayments,
      },
    });
  } catch (error) {
    console.error("Reports GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load reports",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}