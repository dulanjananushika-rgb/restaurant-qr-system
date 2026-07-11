import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Clock,
  CreditCard,
  Package,
  Truck,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import InventoryItem from "@/models/InventoryItem";
import "@/models/Table";
import "@/models/MenuItem";

type TableData = {
  _id: string;
  name: string;
};

type MenuItemData = {
  _id: string;
  name: string;
  price?: number;
};

type OrderItemData = {
  _id: string;
  menuItem?: MenuItemData;
  quantity: number;
  price: number;
};

type OrderData = {
  _id: string;
  table?: TableData;
  items: OrderItemData[];
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
  updatedAt: string;
};

type InventoryData = {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
};

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-US")}`;
}

function statusBadge(status: string) {
  if (status === "PAID" || status === "READY" || status === "DELIVERED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "PENDING" || status === "UNPAID") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }
  if (status === "PREPARING" || status === "PICKED_UP" || status === "ACCEPTED") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }
  if (status === "CANCELLED" || status === "FAILED") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }
  return "border-white/10 bg-white/5 text-neutral-300";
}

async function getDashboardData() {
  await connectDB();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    orders,
    todayOrders,
    activeOrders,
    readyOrders,
    pendingPayments,
    lowStockItems,
    recentOrders,
  ] = await Promise.all([
    Order.find().populate("table").populate("items.menuItem").lean(),
    Order.find({ createdAt: { $gte: startOfToday, $lte: endOfToday } })
      .populate("table")
      .populate("items.menuItem")
      .lean(),
    Order.find({ status: { $in: ["PENDING", "ACCEPTED", "PREPARING"] } })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .lean(),
    Order.find({ status: "READY" })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .lean(),
    Order.find({
      paymentStatus: { $in: ["UNPAID", "PENDING", "PARTIALLY_PAID"] },
      status: { $in: ["READY", "PICKED_UP", "DELIVERED"] },
    })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .lean(),
    InventoryItem.find({ $expr: { $lte: ["$quantity", "$minQuantity"] } })
      .sort({ quantity: 1 })
      .limit(8)
      .lean(),
    Order.find().sort({ createdAt: -1 }).limit(6)
      .populate("table")
      .populate("items.menuItem")
      .lean(),
  ]);

  const paidTodayOrders = todayOrders.filter(
    (order: any) => order.paymentStatus === "PAID"
  );

  const todayRevenue = paidTodayOrders.reduce(
    (sum: number, order: any) => sum + order.totalAmount,
    0
  );

  const totalRevenue = orders
    .filter((order: any) => order.paymentStatus === "PAID")
    .reduce((sum: number, order: any) => sum + order.totalAmount, 0);

  const orderStatusCounts = {
    pending: orders.filter((o: any) => o.status === "PENDING").length,
    accepted: orders.filter((o: any) => o.status === "ACCEPTED").length,
    preparing: orders.filter((o: any) => o.status === "PREPARING").length,
    ready: orders.filter((o: any) => o.status === "READY").length,
    delivered: orders.filter((o: any) => o.status === "DELIVERED").length,
  };

  const topSellingMap = new Map();

  for (const order of todayOrders as any[]) {
    for (const item of order.items || []) {
      const menuItem = item.menuItem;
      if (!menuItem?._id) continue;

      const id = menuItem._id.toString();
      const existing = topSellingMap.get(id);

      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        topSellingMap.set(id, {
          menuItemId: id,
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

  return JSON.parse(
    JSON.stringify({
      cards: {
        todayRevenue,
        totalRevenue,
        todayOrders: todayOrders.length,
        activeOrders: activeOrders.length,
        readyOrders: readyOrders.length,
        pendingPayments: pendingPayments.length,
        lowStockItems: lowStockItems.length,
      },
      orderStatusCounts,
      recentOrders,
      lowStockItems,
      pendingPayments,
      topSellingItems,
    })
  );
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  const recentOrders: OrderData[] = data.recentOrders || [];
  const lowStockItems: InventoryData[] = data.lowStockItems || [];
  const pendingPayments: OrderData[] = data.pendingPayments || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-emerald-300">Restaurant Command Center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back, Admin</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Monitor today's sales, active orders, kitchen flow, cashier payments and inventory alerts.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-neutral-500">Today Revenue</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-300">
              {formatCurrency(data.cards.todayRevenue)}
            </p>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <BarChart3 size={22} />
          </div>
          <p className="text-sm text-neutral-500">Today Revenue</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCurrency(data.cards.todayRevenue)}
          </h3>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
            <ClipboardList size={22} />
          </div>
          <p className="text-sm text-neutral-500">Active Orders</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">{data.cards.activeOrders}</h3>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
            <Truck size={22} />
          </div>
          <p className="text-sm text-neutral-500">Ready Orders</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">{data.cards.readyOrders}</h3>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
            <CreditCard size={22} />
          </div>
          <p className="text-sm text-neutral-500">Pending Bills</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">{data.cards.pendingPayments}</h3>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle size={22} />
          </div>
          <p className="text-sm text-neutral-500">Low Stock</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight">{data.cards.lowStockItems}</h3>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Recent Orders */}
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent Orders</h2>
              <p className="mt-1 text-sm text-neutral-500">Latest customer orders from QR menu.</p>
            </div>
            <Link href="/kitchen/orders" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">
              View kitchen
            </Link>
          </div>

          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-medium">Order #{order._id.slice(-6).toUpperCase()}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                        <Clock size={13} />
                        {order.table?.name || "Take Away"} · {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(order.status)}`}>
                        {order.status}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <p className="text-xs text-neutral-500">{order.items?.length || 0} item(s)</p>
                    <p className="text-sm font-semibold">{formatCurrency(order.totalAmount)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                <p className="text-sm text-neutral-500">No recent orders.</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts - Improved */}
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Low Stock Alerts
                {lowStockItems.length > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-300">
                    {lowStockItems.length}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">Items below minimum stock level</p>
            </div>

            <Link href="/admin/inventory" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">
              Manage Inventory
            </Link>
          </div>

          {lowStockItems.length > 0 ? (
            <div className="space-y-3">
              {lowStockItems.map((item) => {
                const shortage = item.minQuantity - item.quantity;
                return (
                  <div key={item._id} className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Minimum: {item.minQuantity} {item.unit}
                        {shortage > 0 && <span className="ml-2 text-red-400">(Short by {shortage} {item.unit})</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-amber-300">{item.quantity} {item.unit}</p>
                      <p className="text-xs text-neutral-500">Current</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Package className="mx-auto mb-3 text-emerald-400" size={32} />
              <p className="font-medium text-emerald-300">All stock levels are healthy</p>
              <p className="mt-1 text-sm text-neutral-500">No low stock alerts at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Pending Payments + Top Selling */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Pending Payments */}
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pending Payments</h2>
              <p className="mt-1 text-sm text-neutral-500">Pay Later bills waiting for cashier.</p>
            </div>
            <Link href="/cashier/orders" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">
              Cashier
            </Link>
          </div>

          <div className="space-y-3">
            {pendingPayments.length > 0 ? (
              pendingPayments.map((order) => (
                <div key={order._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Bill #{order._id.slice(-6).toUpperCase()}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {order.table?.name || "Take Away"} · {order.status}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-amber-300">{formatCurrency(order.totalAmount)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <p className="text-sm text-neutral-500">No pending payments.</p>
              </div>
            )}
          </div>
        </div>

        {/* Today's Top Selling */}
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Today's Top Selling</h2>
              <p className="mt-1 text-sm text-neutral-500">Based on today's sold quantity.</p>
            </div>
            <Link href="/admin/reports" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10">
              Reports
            </Link>
          </div>

          <div className="space-y-3">
            {data.topSellingItems.length > 0 ? (
              data.topSellingItems.map((item: any) => (
                <div key={item.menuItemId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">{item.quantity} sold today</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">{formatCurrency(item.revenue)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <p className="text-sm text-neutral-500">No sales data for today.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}