import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import AdminOrdersManager from "@/components/admin/AdminOrdersManager";

async function getOrders() {
  await connectDB();

  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .populate("table")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")
    .lean();

  return JSON.parse(JSON.stringify(orders));
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  const totalOrders = orders.length;

  const pendingOrders = orders.filter(
    (order: any) => order.status === "PENDING"
  ).length;

  const preparingOrders = orders.filter(
    (order: any) => order.status === "PREPARING"
  ).length;

  const unpaidOrders = orders.filter(
    (order: any) => order.paymentStatus === "UNPAID"
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Order Management
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Admin orders
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          View customer QR orders, ordered items, kitchen progress, service
          times, payment status and order status from one admin workspace.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Orders</p>
          <h3 className="mt-2 text-3xl font-semibold">{totalOrders}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Pending Orders</p>
          <h3 className="mt-2 text-3xl font-semibold text-amber-300">
            {pendingOrders}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Preparing</p>
          <h3 className="mt-2 text-3xl font-semibold text-purple-300">
            {preparingOrders}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Unpaid Bills</p>
          <h3 className="mt-2 text-3xl font-semibold text-red-300">
            {unpaidOrders}
          </h3>
        </div>
      </section>

      <AdminOrdersManager orders={orders} />
    </div>
  );
}