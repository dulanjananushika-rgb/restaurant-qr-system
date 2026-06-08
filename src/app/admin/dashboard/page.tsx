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

  if (
    status === "PREPARING" ||
    status === "PICKED_UP" ||
    status === "ACCEPTED"
  ) {
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

    Order.find({
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    })
      .populate("table")
      .populate("items.menuItem")
      .lean(),

    Order.find({
      status: { $in: ["PENDING", "ACCEPTED", "PREPARING"] },
    })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .lean(),

    Order.find({
      status: "READY",
    })
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

    InventoryItem.find({
      $expr: {
        $lte: ["$quantity", "$minQuantity"],
      },
    })
      .sort({ quantity: 1 })
      .limit(6)
      .lean(),

    Order.find()
      .sort({ createdAt: -1 })
      .limit(6)
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
    pending: orders.filter((order: any) => order.status === "PENDING").length,
    accepted: orders.filter((order: any) => order.status === "ACCEPTED").length,
    preparing: orders.filter((order: any) => order.status === "PREPARING")
      .length,
    ready: orders.filter((order: any) => order.status === "READY").length,
    delivered: orders.filter((order: any) => order.status === "DELIVERED")
      .length,
  };

  const topSellingMap = new Map<
    string,
    {
      menuItemId: string;
      name: string;
      quantity: number;
      revenue: number;
    }
  >();

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

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "emerald",
}: {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  tone?: "emerald" | "amber" | "sky" | "red" | "purple";
}) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-300",
    amber: "bg-amber-500/10 text-amber-300",
    sky: "bg-sky-500/10 text-sky-300",
    red: "bg-red-500/10 text-red-300",
    purple: "bg-purple-500/10 text-purple-300",
  }[tone];

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}
      >
        <Icon size={22} />
      </div>

      <p className="text-sm text-neutral-500">{title}</p>

      <h3 className="mt-2 text-3xl font-semibold tracking-tight">{value}</h3>

      <p className="mt-2 text-xs leading-5 text-neutral-500">{description}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  const recentOrders: OrderData[] = data.recentOrders || [];
  const lowStockItems: InventoryData[] = data.lowStockItems || [];
  const pendingPayments: OrderData[] = data.pendingPayments || [];

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Restaurant Command Center
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Welcome back, Admin
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Monitor today&apos;s sales, active orders, kitchen flow, cashier
              payments and inventory alerts from one place.
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Today Revenue"
          value={formatCurrency(data.cards.todayRevenue)}
          description="Paid orders received today"
          icon={BarChart3}
          tone="emerald"
        />

        <SummaryCard
          title="Active Orders"
          value={data.cards.activeOrders}
          description="Pending, accepted and preparing"
          icon={ClipboardList}
          tone="sky"
        />

        <SummaryCard
          title="Ready Orders"
          value={data.cards.readyOrders}
          description="Waiting for waiter delivery"
          icon={Truck}
          tone="purple"
        />

        <SummaryCard
          title="Pending Bills"
          value={data.cards.pendingPayments}
          description="Pay later bills to settle"
          icon={CreditCard}
          tone="amber"
        />

        <SummaryCard
          title="Low Stock"
          value={data.cards.lowStockItems}
          description="Ingredients below minimum level"
          icon={AlertTriangle}
          tone="red"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Recent Orders</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Latest customer orders from QR menu.
              </p>
            </div>

            <Link
              href="/kitchen/orders"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/10"
            >
              View kitchen
            </Link>
          </div>

          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order._id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-medium">
                      Order #{order._id.slice(-6).toUpperCase()}
                    </p>

                    <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <Clock size={13} />
                      {order.table?.name || "Take Away"} ·{" "}
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(
                        order.paymentStatus
                      )}`}
                    >
                      {order.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <p className="text-xs text-neutral-500">
                    {order.items?.length || 0} item group(s)
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>
            ))}

            {recentOrders.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                <p className="text-sm text-neutral-500">No recent orders.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold">Order Status Overview</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Overall order workflow status.
            </p>

            <div className="mt-5 space-y-3">
              {[
                ["Pending", data.orderStatusCounts.pending, "text-amber-300"],
                ["Accepted", data.orderStatusCounts.accepted, "text-sky-300"],
                [
                  "Preparing",
                  data.orderStatusCounts.preparing,
                  "text-orange-300",
                ],
                ["Ready", data.orderStatusCounts.ready, "text-emerald-300"],
                [
                  "Delivered",
                  data.orderStatusCounts.delivered,
                  "text-purple-300",
                ],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <p className="text-sm text-neutral-400">{label}</p>
                  <p className={`text-lg font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Low Stock Alerts</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Items below minimum quantity.
                </p>
              </div>

              <Package className="text-amber-300" size={22} />
            </div>

            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Minimum: {item.minQuantity} {item.unit}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-amber-300">
                    {item.quantity} {item.unit}
                  </p>
                </div>
              ))}

              {lowStockItems.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                  <p className="text-sm text-neutral-500">
                    No low stock alerts.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pending Payments</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Pay Later bills waiting for cashier.
              </p>
            </div>

            <Link
              href="/cashier/orders"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/10"
            >
              Cashier
            </Link>
          </div>

          <div className="space-y-3">
            {pendingPayments.map((order) => (
              <div
                key={order._id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Bill #{order._id.slice(-6).toUpperCase()}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {order.table?.name || "Take Away"} · {order.status}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-amber-300">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>
            ))}

            {pendingPayments.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <p className="text-sm text-neutral-500">
                  No pending payments.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Today&apos;s Top Selling
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                Based on today&apos;s sold quantity.
              </p>
            </div>

            <Link
              href="/admin/reports"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 transition hover:bg-white/10"
            >
              Reports
            </Link>
          </div>

          <div className="space-y-3">
            {data.topSellingItems.map(
              (item: {
                menuItemId: string;
                name: string;
                quantity: number;
                revenue: number;
              }) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.quantity} sold today
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(item.revenue)}
                  </p>
                </div>
              )
            )}

            {data.topSellingItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center">
                <p className="text-sm text-neutral-500">
                  No sales data for today.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}