"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";

type TableData = {
  _id: string;
  name: string;
};

type MenuItemData = {
  _id: string;
  name: string;
};

type OrderItem = {
  _id: string;
  menuItem?: MenuItemData;
  quantity: number;
  price: number;
};

type ComboSnapshotItem = {
  name: string;
  quantity: number;
  priceSnapshot: number;
};

type ComboItem = {
  _id: string;
  comboOffer?: {
    _id: string;
    name: string;
  };
  quantity: number;
  price: number;
  originalPrice: number;
  comboItemsSnapshot: ComboSnapshotItem[];
};

type Order = {
  _id: string;
  table?: TableData;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  comboItems?: ComboItem[];
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
};

type Payment = {
  _id: string;
  order?: {
    _id: string;
    table?: TableData;
    totalAmount?: number;
  };
  amount: number;
  method: "CASH" | "CARD" | "ONLINE";
  status: string;
  paidAt: string;
  note?: string;
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

function methodIcon(method: string) {
  if (method === "CASH") return Banknote;
  if (method === "CARD") return CreditCard;
  return Smartphone;
}

export default function CashierPaymentManager({
  unpaidOrders,
  payments,
}: {
  unpaidOrders: Order[];
  payments: Payment[];
}) {
  const router = useRouter();

  const [selectedMethods, setSelectedMethods] = useState<
    Record<string, "CASH" | "CARD" | "ONLINE">
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loadingOrderId, setLoadingOrderId] = useState("");
  const [error, setError] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, router]);

  async function settlePayment(order: Order) {
    const confirmed = confirm(
      `Settle payment for Order #${order._id
        .slice(-6)
        .toUpperCase()} - ${formatCurrency(order.totalAmount)}?`
    );

    if (!confirmed) return;

    setError("");
    setLoadingOrderId(order._id);

    const method = selectedMethods[order._id] || "CASH";

    try {
      const response = await fetch("/api/cashier/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order._id,
          method,
          amount: order.totalAmount,
          note: notes[order._id] || "",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to settle payment");
        return;
      }

      setNotes((current) => ({
        ...current,
        [order._id]: "",
      }));

      router.refresh();
    } catch {
      setError("Something went wrong while settling payment.");
    } finally {
      setLoadingOrderId("");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="flex flex-col justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-emerald-300" />
            <p className="text-sm font-semibold">Cashier live screen</p>
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Orders and payment records auto refresh every 5 seconds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAutoRefreshEnabled((current) => !current)}
          className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
            autoRefreshEnabled
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 bg-black/20 text-neutral-400"
          }`}
        >
          {autoRefreshEnabled ? "Auto refresh ON" : "Auto refresh OFF"}
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Unpaid Orders</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Settle unpaid customer orders and record payment method.
            </p>
          </div>

          <div className="space-y-4">
            {unpaidOrders.map((order) => {
              const isLoading = loadingOrderId === order._id;

              return (
                <article
                  key={order._id}
                  className="rounded-[26px] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          Order #{order._id.slice(-6).toUpperCase()}
                        </h3>

                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                          {order.paymentStatus}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
                          {order.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} />
                          {new Date(order.createdAt).toLocaleString()}
                        </span>

                        <span>{order.table?.name || "No table"}</span>
                        <span>{order.paymentType}</span>
                      </div>

                      {(order.customerName || order.customerPhone) && (
                        <p className="mt-2 text-sm text-neutral-400">
                          Customer: {order.customerName || "N/A"}{" "}
                          {order.customerPhone
                            ? `• ${order.customerPhone}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
                      <p className="text-xs text-neutral-400">Amount Due</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-300">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <ReceiptText size={17} className="text-emerald-300" />
                        <p className="text-sm font-semibold">Menu Items</p>
                      </div>

                      <div className="space-y-2">
                        {order.items?.map((item) => (
                          <div
                            key={item._id}
                            className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm">
                                {item.menuItem?.name || "Menu item"}
                              </p>
                              <p className="text-xs text-neutral-500">
                                Rs. {item.price} × {item.quantity}
                              </p>
                            </div>

                            <p className="text-sm font-semibold">
                              {formatCurrency(item.price * item.quantity)}
                            </p>
                          </div>
                        ))}

                        {(!order.items || order.items.length === 0) && (
                          <p className="text-sm text-neutral-500">
                            No direct menu items.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <CheckCircle2 size={17} className="text-amber-300" />
                        <p className="text-sm font-semibold">Combo Items</p>
                      </div>

                      <div className="space-y-2">
                        {order.comboItems?.map((combo) => (
                          <div
                            key={combo._id}
                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-emerald-100">
                                  {combo.comboOffer?.name || "Combo offer"}
                                </p>
                                <p className="mt-1 text-xs text-neutral-400">
                                  Rs. {combo.price} × {combo.quantity}
                                </p>
                              </div>

                              <p className="text-sm font-semibold text-emerald-300">
                                {formatCurrency(combo.price * combo.quantity)}
                              </p>
                            </div>

                            <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                              {combo.comboItemsSnapshot?.map(
                                (snapshot, index) => (
                                  <p
                                    key={`${combo._id}-${index}`}
                                    className="text-xs text-neutral-400"
                                  >
                                    • {snapshot.name} × {snapshot.quantity}
                                  </p>
                                )
                              )}
                            </div>
                          </div>
                        ))}

                        {(!order.comboItems ||
                          order.comboItems.length === 0) && (
                          <p className="text-sm text-neutral-500">
                            No combo items.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-[0.7fr_1fr_auto] md:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs text-neutral-500">
                        Payment Method
                      </span>

                      <select
                        value={selectedMethods[order._id] || "CASH"}
                        onChange={(event) =>
                          setSelectedMethods((current) => ({
                            ...current,
                            [order._id]: event.target.value as
                              | "CASH"
                              | "CARD"
                              | "ONLINE",
                          }))
                        }
                        disabled={isLoading}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none disabled:opacity-50"
                      >
                        <option className="bg-[#0B0F14]" value="CASH">
                          CASH
                        </option>
                        <option className="bg-[#0B0F14]" value="CARD">
                          CARD
                        </option>
                        <option className="bg-[#0B0F14]" value="ONLINE">
                          ONLINE
                        </option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs text-neutral-500">
                        Note optional
                      </span>

                      <input
                        value={notes[order._id] || ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [order._id]: event.target.value,
                          }))
                        }
                        disabled={isLoading}
                        placeholder="Cash received / card reference"
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 disabled:opacity-50"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => settlePayment(order)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                      {isLoading ? "Settling..." : "Settle"}
                    </button>
                  </div>
                </article>
              );
            })}

            {unpaidOrders.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">
                <CheckCircle2
                  className="mx-auto mb-3 text-emerald-300"
                  size={38}
                />
                <p className="text-sm text-neutral-400">
                  No unpaid orders right now.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Recent Payments</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Latest settled payment records and receipt access.
            </p>
          </div>

          <div className="space-y-3">
            {payments.map((payment) => {
              const Icon = methodIcon(payment.method);

              return (
                <div
                  key={payment._id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {formatCurrency(payment.amount)}
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            {payment.method} • {payment.status}
                          </p>
                        </div>

                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                          PAID
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-neutral-500">
                        Order #
                        {payment.order?._id
                          ? payment.order._id.slice(-6).toUpperCase()
                          : "N/A"}{" "}
                        • {payment.order?.table?.name || "No table"}
                      </p>

                      <p className="mt-1 text-xs text-neutral-600">
                        {new Date(payment.paidAt).toLocaleString()}
                      </p>

                      {payment.order?._id && (
                        <Link
                          href={`/cashier/receipt/${payment.order._id}`}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white"
                        >
                          <ReceiptText size={15} />
                          View / Print Receipt
                        </Link>
                      )}

                      {payment.note && (
                        <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-400">
                          {payment.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {payments.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">
                <CreditCard
                  className="mx-auto mb-3 text-neutral-600"
                  size={36}
                />
                <p className="text-sm text-neutral-500">
                  No payments recorded yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}