import { NextResponse } from "next/server";
import { type Types } from "mongoose";

import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import InventoryItem from "@/models/InventoryItem";
import MenuItem from "@/models/MenuItem";
import "@/models/Table";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type TopSellingAggResult = {
  _id: Types.ObjectId | null;
  quantity: number;
  revenue: number;
};

type RevenueAggResult = {
  _id: null;
  total: number;
};

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      totalOrders,
      todayOrdersCount,
      paidOrdersCount,
      unpaidOrdersCount,
      todayRevenueAgg,
      totalRevenueAgg,
      topSellingAgg,
      lowStockItems,
      recentOrders,
      recentPayments,
    ] = await Promise.all([
      Order.countDocuments(),

      Order.countDocuments({
        createdAt: {
          $gte: startOfToday,
          $lte: endOfToday,
        },
      }),

      Order.countDocuments({ paymentStatus: "PAID" }),

      Order.countDocuments({
        paymentStatus: { $in: ["UNPAID", "PENDING", "PARTIALLY_PAID"] },
      }),

      Order.aggregate<RevenueAggResult>([
        {
          $match: {
            createdAt: { $gte: startOfToday, $lte: endOfToday },
            paymentStatus: "PAID",
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      Order.aggregate<RevenueAggResult>([
        { $match: { paymentStatus: "PAID" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      Order.aggregate<TopSellingAggResult>([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.menuItem",
            quantity: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.price", "$items.quantity"] },
            },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
      ]),

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

    const todayRevenue = todayRevenueAgg[0]?.total ?? 0;
    const totalRevenue = totalRevenueAgg[0]?.total ?? 0;

    const topMenuIds = topSellingAgg
      .map((item) => item._id)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const topMenuItems = topMenuIds.length
      ? await MenuItem.find({ _id: { $in: topMenuIds } })
          .select("name")
          .lean<{ _id: Types.ObjectId; name: string }[]>()
      : [];

    const menuNameMap = new Map(
      topMenuItems.map((item) => [item._id.toString(), item.name])
    );

    const topSellingItems = topSellingAgg
      .filter((item) => Boolean(item._id))
      .map((item) => {
        const idStr = item._id ? item._id.toString() : "";
        return {
          menuItemId: idStr,
          name: menuNameMap.get(idStr) || "Menu item",
          quantity: item.quantity,
          revenue: item.revenue,
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        cards: {
          todayRevenue,
          totalRevenue,
          totalOrders,
          todayOrders: todayOrdersCount,
          paidOrders: paidOrdersCount,
          unpaidOrders: unpaidOrdersCount,
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
