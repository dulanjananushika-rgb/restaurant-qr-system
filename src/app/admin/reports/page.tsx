import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Package,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  Utensils,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import InventoryItem from "@/models/InventoryItem";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

type ReportCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  tone?: "emerald" | "amber" | "sky" | "red" | "purple";
};

function formatCurrency(amount: number) {
  return `Rs. ${amount.toLocaleString("en-US")}`;
}

function ReportCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "emerald",
}: ReportCardProps) {
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

async function getReportsData() {
  await connectDB();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [orders, todayOrders, lowStockItems] = await Promise.all([
    Order.find()
      .sort({ createdAt: -1 })
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean(),

    Order.find({
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    })
      .sort({ createdAt: -1 })
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean(),

    InventoryItem.find({
      $expr: {
        $lte: ["$quantity", "$minQuantity"],
      },
    })
      .sort({ quantity: 1 })
      .limit(8)
      .lean(),
  ]);

  const paidOrders = orders.filter((order: any) => order.paymentStatus === "PAID");

  const unpaidOrders = orders.filter(
    (order: any) => order.paymentStatus === "UNPAID"
  );

  const todayPaidOrders = todayOrders.filter(
    (order: any) => order.paymentStatus === "PAID"
  );

  const totalRevenue = paidOrders.reduce(
    (sum: number, order: any) => sum + Number(order.totalAmount || 0),
    0
  );

  const todayRevenue = todayPaidOrders.reduce(
    (sum: number, order: any) => sum + Number(order.totalAmount || 0),
    0
  );

  const normalItemSalesMap = new Map<
    string,
    {
      id: string;
      name: string;
      quantity: number;
      revenue: number;
    }
  >();

  const comboSalesMap = new Map<
    string,
    {
      id: string;
      name: string;
      quantity: number;
      revenue: number;
      originalRevenue: number;
      savingsGiven: number;
    }
  >();

  const expandedMenuSalesMap = new Map<
    string,
    {
      id: string;
      name: string;
      quantity: number;
      revenue: number;
    }
  >();

  for (const order of orders as any[]) {
    for (const item of order.items || []) {
      const menuItem = item.menuItem;

      if (!menuItem?._id) continue;

      const id = menuItem._id.toString();
      const quantity = Number(item.quantity || 0);
      const revenue = Number(item.price || 0) * quantity;

      const existing = normalItemSalesMap.get(id);

      if (existing) {
        existing.quantity += quantity;
        existing.revenue += revenue;
      } else {
        normalItemSalesMap.set(id, {
          id,
          name: menuItem.name || "Menu item",
          quantity,
          revenue,
        });
      }

      const expandedExisting = expandedMenuSalesMap.get(id);

      if (expandedExisting) {
        expandedExisting.quantity += quantity;
        expandedExisting.revenue += revenue;
      } else {
        expandedMenuSalesMap.set(id, {
          id,
          name: menuItem.name || "Menu item",
          quantity,
          revenue,
        });
      }
    }

    for (const combo of order.comboItems || []) {
      const comboOffer = combo.comboOffer;
      const id = comboOffer?._id?.toString() || combo._id?.toString();
      const quantity = Number(combo.quantity || 0);
      const revenue = Number(combo.price || 0) * quantity;
      const originalRevenue = Number(combo.originalPrice || 0) * quantity;
      const savingsGiven = Math.max(originalRevenue - revenue, 0);

      const existing = comboSalesMap.get(id);

      if (existing) {
        existing.quantity += quantity;
        existing.revenue += revenue;
        existing.originalRevenue += originalRevenue;
        existing.savingsGiven += savingsGiven;
      } else {
        comboSalesMap.set(id, {
          id,
          name: comboOffer?.name || "Combo offer",
          quantity,
          revenue,
          originalRevenue,
          savingsGiven,
        });
      }

      for (const snapshot of combo.comboItemsSnapshot || []) {
        const menuId = snapshot.menuItem?.toString() || snapshot.name;
        const menuQuantity = Number(snapshot.quantity || 0) * quantity;
        const menuRevenue = Number(snapshot.priceSnapshot || 0) * menuQuantity;

        const expandedExisting = expandedMenuSalesMap.get(menuId);

        if (expandedExisting) {
          expandedExisting.quantity += menuQuantity;
          expandedExisting.revenue += menuRevenue;
        } else {
          expandedMenuSalesMap.set(menuId, {
            id: menuId,
            name: snapshot.name || "Menu item",
            quantity: menuQuantity,
            revenue: menuRevenue,
          });
        }
      }
    }
  }

  const topNormalItems = Array.from(normalItemSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  const topComboSales = Array.from(comboSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  const topExpandedMenuItems = Array.from(expandedMenuSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const totalComboRevenue = Array.from(comboSalesMap.values()).reduce(
    (sum, combo) => sum + combo.revenue,
    0
  );

  const totalSavingsGiven = Array.from(comboSalesMap.values()).reduce(
    (sum, combo) => sum + combo.savingsGiven,
    0
  );

  return JSON.parse(
    JSON.stringify({
      summary: {
        totalRevenue,
        todayRevenue,
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        paidOrders: paidOrders.length,
        unpaidOrders: unpaidOrders.length,
        totalComboRevenue,
        totalSavingsGiven,
        lowStockCount: lowStockItems.length,
      },
      topNormalItems,
      topComboSales,
      topExpandedMenuItems,
      lowStockItems,
    })
  );
}

export default async function ReportsPage() {
  const data = await getReportsData();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
        <p className="text-sm font-medium text-emerald-300">Reports</p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Sales and inventory reports
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Monitor revenue, order performance, combo offer sales, top selling
          items and low stock ingredients.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          title="Total Revenue"
          value={formatCurrency(data.summary.totalRevenue)}
          description="All paid order revenue"
          icon={TrendingUp}
          tone="emerald"
        />

        <ReportCard
          title="Today Revenue"
          value={formatCurrency(data.summary.todayRevenue)}
          description="Paid revenue received today"
          icon={BarChart3}
          tone="sky"
        />

        <ReportCard
          title="Total Orders"
          value={data.summary.totalOrders}
          description={`${data.summary.todayOrders} orders placed today`}
          icon={ReceiptText}
          tone="purple"
        />

        <ReportCard
          title="Unpaid Bills"
          value={data.summary.unpaidOrders}
          description="Orders waiting for payment"
          icon={CreditCard}
          tone="amber"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          title="Combo Revenue"
          value={formatCurrency(data.summary.totalComboRevenue)}
          description="Revenue generated from combo offers"
          icon={ShoppingBag}
          tone="emerald"
        />

        <ReportCard
          title="Savings Given"
          value={formatCurrency(data.summary.totalSavingsGiven)}
          description="Discount value offered to customers"
          icon={BarChart3}
          tone="sky"
        />

        <ReportCard
          title="Low Stock Items"
          value={data.summary.lowStockCount}
          description="Ingredients below minimum level"
          icon={AlertTriangle}
          tone="red"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              Top Selling Menu Items
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Includes normal orders and menu items inside combo offers.
            </p>
          </div>

          <div className="space-y-3">
            {data.topExpandedMenuItems.map(
              (item: {
                id: string;
                name: string;
                quantity: number;
                revenue: number;
              }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.quantity} sold
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(item.revenue)}
                  </p>
                </div>
              )
            )}

            {data.topExpandedMenuItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
                <Utensils className="mx-auto mb-3 text-neutral-600" size={34} />
                <p className="text-sm text-neutral-500">
                  No item sales data yet.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Combo Offer Sales</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Performance of special combo deals.
            </p>
          </div>

          <div className="space-y-3">
            {data.topComboSales.map(
              (combo: {
                id: string;
                name: string;
                quantity: number;
                revenue: number;
                savingsGiven: number;
              }) => (
                <div
                  key={combo.id}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-100">
                        {combo.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">
                        {combo.quantity} combo(s) sold
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-emerald-300">
                      {formatCurrency(combo.revenue)}
                    </p>
                  </div>

                  <p className="mt-2 text-xs text-neutral-500">
                    Savings given: {formatCurrency(combo.savingsGiven)}
                  </p>
                </div>
              )
            )}

            {data.topComboSales.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
                <ShoppingBag
                  className="mx-auto mb-3 text-neutral-600"
                  size={34}
                />
                <p className="text-sm text-neutral-500">
                  No combo sales data yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Normal Item Sales</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Direct menu item sales, excluding combo expansion.
            </p>
          </div>

          <div className="space-y-3">
            {data.topNormalItems.map(
              (item: {
                id: string;
                name: string;
                quantity: number;
                revenue: number;
              }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.quantity} direct sale(s)
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-sky-300">
                    {formatCurrency(item.revenue)}
                  </p>
                </div>
              )
            )}

            {data.topNormalItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
                <p className="text-sm text-neutral-500">
                  No normal item sales data yet.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Low Stock Summary</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Ingredients that need restocking.
              </p>
            </div>

            <Package className="text-amber-300" size={22} />
          </div>

          <div className="space-y-3">
            {data.lowStockItems.map(
              (item: {
                _id: string;
                name: string;
                unit: string;
                quantity: number;
                minQuantity: number;
              }) => (
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
              )
            )}

            {data.lowStockItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
                <p className="text-sm text-neutral-500">
                  No low stock items.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}