import { CheckCircle2, Clock, HandPlatter, Truck } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import WaiterOrderManager from "@/components/waiter/WaiterOrderManager";
import LogoutButton from "@/components/auth/LogoutButton";
export const dynamic = 'force-dynamic';

async function getWaiterOrders() {
  await connectDB();

  const orders = await Order.find({
    status: {
      $in: ["READY", "PICKED_UP", "DELIVERED"],
    },
  })
    .sort({ createdAt: -1 })
    .populate("table")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")
    .lean();

  return JSON.parse(JSON.stringify(orders));
}

export default async function WaiterOrdersPage() {
  const orders = await getWaiterOrders();

  const readyOrders = orders.filter(
    (order: any) => order.status === "READY"
  ).length;

  const pickedUpOrders = orders.filter(
    (order: any) => order.status === "PICKED_UP"
  ).length;

  const deliveredOrders = orders.filter(
    (order: any) => order.status === "DELIVERED"
  ).length;

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with Logout Button */}
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-300">
                Waiter Workspace
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Pickup and deliver table orders
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                View kitchen-ready orders, pick them up from the kitchen and mark
                them as delivered after serving the customer.
              </p>
            </div>

            <LogoutButton />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <HandPlatter size={21} />
            </div>

            <p className="text-sm text-neutral-500">Service Orders</p>
            <h3 className="mt-2 text-3xl font-semibold">{orders.length}</h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <Clock size={21} />
            </div>

            <p className="text-sm text-neutral-500">Ready</p>
            <h3 className="mt-2 text-3xl font-semibold text-amber-300">
              {readyOrders}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
              <Truck size={21} />
            </div>

            <p className="text-sm text-neutral-500">Picked Up</p>
            <h3 className="mt-2 text-3xl font-semibold text-sky-300">
              {pickedUpOrders}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
              <CheckCircle2 size={21} />
            </div>

            <p className="text-sm text-neutral-500">Delivered</p>
            <h3 className="mt-2 text-3xl font-semibold text-purple-300">
              {deliveredOrders}
            </h3>
          </div>
        </section>

        <WaiterOrderManager orders={orders} />
      </div>
    </main>
  );
}