"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCcw,
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
  status: string;
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
};

export default function CashierOrdersClient({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [loadingOrderId, setLoadingOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "ONLINE">(
    "CASH"
  );

  async function markAsPaid(orderId: string) {
    setLoadingOrderId(orderId);

    try {
      const response = await fetch(`/api/cashier/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethod,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to complete payment");
        return;
      }

      router.refresh();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingOrderId("");
    }
  }

  const totalPendingAmount = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <section className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Cashier Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Pay Later Bills
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Confirm cash or card payments for delivered customer orders.
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
            <p className="text-sm text-neutral-500">Pending Bills</p>
            <h3 className="mt-2 text-3xl font-semibold">{orders.length}</h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-neutral-500">Pending Amount</p>
            <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
              Rs. {totalPendingAmount}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm text-neutral-500">Default Method</p>
            <h3 className="mt-2 text-3xl font-semibold text-sky-300">
              {paymentMethod}
            </h3>
          </div>
        </section>

        <section className="mb-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 text-sm font-medium">Payment Method</p>

          <div className="grid gap-3 sm:grid-cols-3">
            {(["CASH", "CARD", "ONLINE"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                  paymentMethod === method
                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 text-neutral-400 hover:bg-white/10"
                }`}
              >
                {method === "CASH" ? (
                  <Banknote size={17} />
                ) : method === "CARD" ? (
                  <CreditCard size={17} />
                ) : (
                  <ReceiptText size={17} />
                )}
                {method}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => (
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
                    Bill #{order._id.slice(-6).toUpperCase()}
                  </h2>
                  <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                    <Clock size={14} />
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>

                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                  {order.paymentStatus}
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
                  <p className="text-xs text-neutral-500">Order Status</p>
                  <p className="mt-1 text-sm font-medium">{order.status}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-neutral-500">Payment Type</p>
                  <p className="mt-1 text-sm font-medium">
                    {order.paymentType}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <div>
                  <p className="text-xs text-neutral-500">Total</p>
                  <p className="text-2xl font-semibold">
                    Rs. {order.totalAmount}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loadingOrderId === order._id}
                  onClick={() => markAsPaid(order._id)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingOrderId === order._id ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={17} />
                  )}
                  {loadingOrderId === order._id ? "Updating..." : "Mark Paid"}
                </button>
              </div>
            </div>
          ))}
        </section>

        {orders.length === 0 && (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center">
            <ReceiptText className="mx-auto mb-3 text-neutral-600" size={38} />
            <h2 className="text-xl font-semibold">No pending bills</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Pay Later delivered orders will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}