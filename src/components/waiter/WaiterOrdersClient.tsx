"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Truck,
  Utensils,
} from "lucide-react";

type MenuItem = {
  _id: string;
  name: string;
  price: number;
};

type OrderItem = {
  _id: string;
  menuItem?: MenuItem;
  quantity: number;
  price: number;
};

type TableData = {
  _id: string;
  name: string;
};

type Order = {
  _id: string;
  table?: TableData;
  items: OrderItem[];
  totalAmount: number;
  status: "READY" | "PICKED_UP";
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
};

function statusStyle(status: Order["status"]) {
  if (status === "READY") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-300";
}

function nextAction(status: Order["status"]) {
  if (status === "READY") {
    return {
      label: "Pick Up Order",
      nextStatus: "PICKED_UP",
      icon: PackageCheck,
    };
  }

  if (status === "PICKED_UP") {
    return {
      label: "Mark Delivered",
      nextStatus: "DELIVERED",
      icon: CheckCircle2,
    };
  }

  return null;
}

export default function WaiterOrdersClient({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [loadingOrderId, setLoadingOrderId] = useState("");

  async function updateStatus(orderId: string, status: string) {
    setLoadingOrderId(orderId);

    try {
      const response = await fetch(`/api/waiter/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to update order");
        return;
      }

      router.refresh();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingOrderId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Waiter Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Ready Orders for Table Delivery
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Pick up prepared orders from the kitchen and mark them as
              delivered after serving the table.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            <RefreshCcw size={17} />
            Refresh
          </button>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-neutral-500">Orders for Delivery</p>
            <h3 className="mt-2 text-3xl font-semibold">{orders.length}</h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-neutral-500">Ready</p>
            <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
              {orders.filter((order) => order.status === "READY").length}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-neutral-500">Picked Up</p>
            <h3 className="mt-2 text-3xl font-semibold text-sky-300">
              {orders.filter((order) => order.status === "PICKED_UP").length}
            </h3>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => {
            const action = nextAction(order.status);
            const ActionIcon = action?.icon;

            return (
              <div
                key={order._id}
                className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">
                      {order.table?.name || "Take Away"}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      Order #{order._id.slice(-6).toUpperCase()}
                    </h2>
                    <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                      <Clock size={14} />
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyle(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {item.menuItem?.name || "Menu item"}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Qty: {item.quantity}
                        </p>
                      </div>

                      <p className="text-sm font-semibold">
                        Rs. {item.price * item.quantity}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-neutral-500">Payment</p>
                    <p className="mt-1 text-sm font-medium">
                      {order.paymentType} / {order.paymentStatus}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs text-neutral-500">Total</p>
                    <p className="mt-1 text-lg font-semibold">
                      Rs. {order.totalAmount}
                    </p>
                  </div>
                </div>

                {action && ActionIcon && (
                  <button
                    type="button"
                    disabled={loadingOrderId === order._id}
                    onClick={() => updateStatus(order._id, action.nextStatus)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingOrderId === order._id ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ActionIcon size={17} />
                    )}
                    {loadingOrderId === order._id
                      ? "Updating..."
                      : action.label}
                  </button>
                )}
              </div>
            );
          })}
        </section>

        {orders.length === 0 && (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center">
            <Truck className="mx-auto mb-3 text-neutral-600" size={38} />
            <h2 className="text-xl font-semibold">No orders for delivery</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Kitchen-ready orders will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}