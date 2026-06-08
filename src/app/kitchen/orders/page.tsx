import { ChefHat, Clock, Flame, PackageCheck } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import KitchenOrderManager from "@/components/kitchen/KitchenOrderManager";

async function getKitchenOrders() {
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

  return JSON.parse(JSON.stringify(orders));
}

export default async function KitchenOrdersPage() {
  const orders = await getKitchenOrders();

  const pendingOrders = orders.filter(
    (order: any) => order.status === "PENDING"
  ).length;

  const acceptedOrders = orders.filter(
    (order: any) => order.status === "ACCEPTED"
  ).length;

  const preparingOrders = orders.filter(
    (order: any) => order.status === "PREPARING"
  ).length;

  const readyOrders = orders.filter(
    (order: any) => order.status === "READY"
  ).length;

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
          <p className="text-sm font-medium text-orange-300">
            Kitchen Workspace
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Prepare customer orders
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            View incoming QR orders, accept them from the kitchen screen, start
            preparation and mark dishes as ready for waiter pickup.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-300">
              <ChefHat size={21} />
            </div>

            <p className="text-sm text-neutral-500">Active Orders</p>
            <h3 className="mt-2 text-3xl font-semibold">{orders.length}</h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <Clock size={21} />
            </div>

            <p className="text-sm text-neutral-500">Pending</p>
            <h3 className="mt-2 text-3xl font-semibold text-amber-300">
              {pendingOrders}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
              <PackageCheck size={21} />
            </div>

            <p className="text-sm text-neutral-500">Accepted</p>
            <h3 className="mt-2 text-3xl font-semibold text-sky-300">
              {acceptedOrders}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
              <Flame size={21} />
            </div>

            <p className="text-sm text-neutral-500">Preparing</p>
            <h3 className="mt-2 text-3xl font-semibold text-purple-300">
              {preparingOrders}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <PackageCheck size={21} />
            </div>

            <p className="text-sm text-neutral-500">Ready</p>
            <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
              {readyOrders}
            </h3>
          </div>
        </section>

        <KitchenOrderManager orders={orders} />
      </div>
    </main>
  );
}