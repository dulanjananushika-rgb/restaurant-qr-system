"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HandPlatter,
  History,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Truck,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  comboItemsSnapshot: ComboSnapshotItem[];
};

type StatusHistoryItem = {
  _id?: string;
  fromStatus?: string;
  toStatus: string;
  changedByName?: string;
  changedByRole?: string;
  note?: string;
  changedAt: string;
};

type Order = {
  _id: string;
  table?: TableData | null;
  orderType?: "DINE_IN" | "TAKE_AWAY" | "ONLINE";
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  comboItems?: ComboItem[];
  totalAmount: number;
  status: "READY" | "PICKED_UP" | "DELIVERED";
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  statusHistory?: StatusHistoryItem[];
};

function statusClass(status: string) {
  if (status === "READY") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (status === "PICKED_UP") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }

  if (status === "DELIVERED") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-300";
}

function orderTypeClass(orderType?: string) {
  if (orderType === "TAKE_AWAY") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  }

  if (orderType === "ONLINE") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }

  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
}

function getOrderTypeLabel(orderType?: string) {
  if (orderType === "TAKE_AWAY") return "TAKEAWAY";
  if (orderType === "ONLINE") return "ONLINE";
  return "DINE-IN";
}

function getOrderLocation(order: Order) {
  if (order.orderType === "TAKE_AWAY") {
    return "Counter pickup";
  }

  return order.table?.name || "No table";
}

function getNextAction(status: string) {
  if (status === "READY") {
    return {
      nextStatus: "PICKED_UP",
      label: "Pick up order",
      icon: Truck,
    };
  }

  if (status === "PICKED_UP") {
    return {
      nextStatus: "DELIVERED",
      label: "Mark delivered",
      icon: CheckCircle2,
    };
  }

  return null;
}

function formatDateTime(date?: string | null) {
  if (!date) return "Not set";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Invalid date";
  }

  return parsedDate.toLocaleString();
}

function getElapsedMinutes(fromDate?: string | null, toDate?: string | null) {
  if (!fromDate) return null;

  const start = new Date(fromDate).getTime();

  if (Number.isNaN(start)) return null;

  const end = toDate ? new Date(toDate).getTime() : Date.now();

  if (Number.isNaN(end)) return null;

  const diffMs = Math.max(end - start, 0);

  return Math.floor(diffMs / 60000);
}

function getElapsedText(minutes: number | null) {
  if (minutes === null) return "Not started";
  if (minutes < 1) return "Less than 1 min";
  if (minutes === 1) return "1 min";

  return `${minutes} mins`;
}

function getDelayLevel(order: Order) {
  const pickupWaitingMinutes = getElapsedMinutes(order.readyAt, order.pickedUpAt);

  const deliveryWaitingMinutes = getElapsedMinutes(
    order.pickedUpAt,
    order.deliveredAt
  );

  if (order.status === "READY" && pickupWaitingMinutes !== null) {
    if (pickupWaitingMinutes >= 10) return "CRITICAL";
    if (pickupWaitingMinutes >= 5) return "WARNING";
  }

  if (order.status === "PICKED_UP" && deliveryWaitingMinutes !== null) {
    if (deliveryWaitingMinutes >= 15) return "CRITICAL";
    if (deliveryWaitingMinutes >= 8) return "WARNING";
  }

  return "NORMAL";
}

function delayCardClass(delayLevel: string) {
  if (delayLevel === "CRITICAL") {
    return "border-red-500/40 bg-red-500/[0.08]";
  }

  if (delayLevel === "WARNING") {
    return "border-amber-500/40 bg-amber-500/[0.08]";
  }

  return "border-white/10 bg-white/[0.03]";
}

export default function WaiterOrderManager({ orders }: { orders: Order[] }) {
  const router = useRouter();

  const [filter, setFilter] = useState<
    "ALL" | "READY" | "PICKED_UP" | "DELIVERED"
  >("ALL");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, router]);

  const filteredOrders = useMemo(() => {
    if (filter === "ALL") return orders;

    return orders.filter((order) => order.status === filter);
  }, [orders, filter]);

  function toggleDetails(orderId: string) {
    setExpandedOrders((current) => ({
      ...current,
      [orderId]: !current[orderId],
    }));
  }

  async function updateWaiterStatus(orderId: string, status: string) {
    setError("");
    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(`/api/waiter/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          note: notes[orderId] || "",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to update waiter order");
        return;
      }

      setNotes((current) => ({
        ...current,
        [orderId]: "",
      }));

      router.refresh();
    } catch {
      setError("Something went wrong while updating order.");
    } finally {
      setUpdatingOrderId("");
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="flex flex-col justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw size={18} className="text-emerald-300" />
            <p className="text-sm font-semibold">Waiter live screen</p>
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Clean delivery view. Time tracking and history are available under
            View Details.
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

      <section className="flex flex-wrap gap-2">
        {["ALL", "READY", "PICKED_UP", "DELIVERED"].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status as any)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === status
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {status}
          </button>
        ))}
      </section>

      <section className="grid items-stretch gap-4 xl:grid-cols-2">
        {filteredOrders.map((order) => {
          const nextAction = getNextAction(order.status);
          const ActionIcon = nextAction?.icon;
          const delayLevel = getDelayLevel(order);
          const isExpanded = expandedOrders[order._id] || false;

          const pickupWaitingMinutes = getElapsedMinutes(
            order.readyAt,
            order.pickedUpAt
          );

          const deliveryWaitingMinutes = getElapsedMinutes(
            order.pickedUpAt,
            order.deliveredAt
          );

          return (
            <article
              key={order._id}
              className={`flex h-full min-h-[620px] flex-col rounded-[26px] border p-5 transition ${delayCardClass(
                delayLevel
              )}`}
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      Order #{order._id.slice(-6).toUpperCase()}
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${orderTypeClass(
                        order.orderType
                      )}`}
                    >
                      {getOrderTypeLabel(order.orderType)}
                    </span>

                    {delayLevel !== "NORMAL" && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                          delayLevel === "CRITICAL"
                            ? "border-red-500/30 bg-red-500/15 text-red-300"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        <AlertTriangle size={13} />
                        {delayLevel === "CRITICAL" ? "Delayed" : "Warning"}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-400">
                    <span className="inline-flex items-center gap-2">
                      {order.orderType === "TAKE_AWAY" ? (
                        <ShoppingBag size={16} className="text-purple-300" />
                      ) : (
                        <Utensils size={16} className="text-emerald-300" />
                      )}

                      {getOrderLocation(order)}
                    </span>

                    <span>{order.paymentType}</span>
                    <span>{order.paymentStatus}</span>
                  </div>

                  {(order.customerName || order.customerPhone) && (
                    <p className="mt-2 text-sm text-neutral-400">
                      Customer: {order.customerName || "N/A"}
                      {order.customerPhone ? ` • ${order.customerPhone}` : ""}
                    </p>
                  )}
                </div>

                <div className="shrink-0 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-left sm:w-44 sm:text-right">
                  <p className="text-xs text-neutral-400">
                    {order.orderType === "TAKE_AWAY"
                      ? "Pickup from"
                      : "Deliver to"}
                  </p>

                  <p className="mt-1 break-words text-xl font-black text-emerald-300">
                    {getOrderLocation(order)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid flex-1 gap-4 lg:grid-cols-2">
                <section className="flex min-h-[230px] flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Utensils size={17} className="text-emerald-300" />
                      <h3 className="text-sm font-semibold">Menu Items</h3>
                    </div>

                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-neutral-400">
                      {order.items?.length || 0}
                    </span>
                  </div>

                  <div className="max-h-[170px] space-y-2 overflow-y-auto pr-1">
                    {order.items?.map((item) => (
                      <div
                        key={item._id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <p className="line-clamp-2 text-sm">
                          {item.menuItem?.name || "Menu item"}
                        </p>

                        <p className="shrink-0 text-sm font-semibold">
                          × {item.quantity}
                        </p>
                      </div>
                    ))}

                    {(!order.items || order.items.length === 0) && (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center">
                        <p className="text-sm text-neutral-500">
                          No normal menu items.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="flex min-h-[230px] flex-col rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ReceiptText size={17} className="text-amber-300" />
                      <h3 className="text-sm font-semibold">Combo Items</h3>
                    </div>

                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-neutral-400">
                      {order.comboItems?.length || 0}
                    </span>
                  </div>

                  <div className="max-h-[170px] space-y-2 overflow-y-auto pr-1">
                    {order.comboItems?.map((combo) => (
                      <div
                        key={combo._id}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-semibold text-emerald-100">
                            {combo.comboOffer?.name || "Combo offer"}
                          </p>

                          <p className="shrink-0 text-sm font-semibold">
                            × {combo.quantity}
                          </p>
                        </div>

                        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                          {combo.comboItemsSnapshot?.map((snapshot, index) => (
                            <p
                              key={`${combo._id}-${index}`}
                              className="line-clamp-1 text-xs text-neutral-400"
                            >
                              • {snapshot.name} ×{" "}
                              {snapshot.quantity * combo.quantity}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}

                    {(!order.comboItems || order.comboItems.length === 0) && (
                      <div className="flex min-h-[118px] items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center">
                        <p className="text-sm text-neutral-500">
                          No combo items.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {isExpanded && (
                <section className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock size={17} className="text-sky-300" />
                    <h3 className="text-sm font-semibold">Delivery Details</h3>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Created</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Ready Time</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.readyAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Pickup Waiting</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {getElapsedText(pickupWaitingMinutes)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Picked Up</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.pickedUpAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">
                        Delivery Waiting
                      </p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {getElapsedText(deliveryWaitingMinutes)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Delivered</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.deliveredAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <History size={17} className="text-sky-300" />
                      <h3 className="text-sm font-semibold">Status History</h3>
                    </div>

                    <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                      {order.statusHistory && order.statusHistory.length > 0 ? (
                        order.statusHistory
                          .slice()
                          .reverse()
                          .map((history, index) => (
                            <div
                              key={
                                history._id ||
                                `${order._id}-history-${index}`
                              }
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                            >
                              <p className="text-xs text-neutral-300">
                                {history.fromStatus || "START"} →{" "}
                                <span className="font-semibold text-emerald-300">
                                  {history.toStatus}
                                </span>
                              </p>

                              <p className="mt-1 text-[11px] text-neutral-500">
                                By {history.changedByName || "System"}{" "}
                                {history.changedByRole
                                  ? `(${history.changedByRole})`
                                  : ""}{" "}
                                • {formatDateTime(history.changedAt)}
                              </p>

                              {history.note && (
                                <p className="mt-2 rounded-lg bg-black/20 px-2 py-1 text-[11px] text-neutral-400">
                                  Note: {history.note}
                                </p>
                              )}
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-neutral-500">
                          No status history yet.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <div className="mt-auto pt-5">
                {nextAction && (
                  <label className="mb-3 block">
                    <span className="mb-2 block text-xs text-neutral-500">
                      Waiter note optional
                    </span>

                    <input
                      value={notes[order._id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [order._id]: event.target.value,
                        }))
                      }
                      placeholder="Example: Picked up from kitchen / Delivered to table"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
                    />
                  </label>
                )}

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  {nextAction && ActionIcon ? (
                    <button
                      type="button"
                      disabled={updatingOrderId === order._id}
                      onClick={() =>
                        updateWaiterStatus(order._id, nextAction.nextStatus)
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingOrderId === order._id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <ActionIcon size={18} />
                      )}

                      {updatingOrderId === order._id
                        ? "Updating..."
                        : nextAction.label}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-300">
                      Delivered to customer
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleDetails(order._id)}
                    className="inline-flex min-w-[145px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {isExpanded ? (
                      <ChevronUp size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}
                    {isExpanded ? "Hide Details" : "View Details"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-10 text-center xl:col-span-2">
            <HandPlatter className="mx-auto mb-3 text-neutral-600" size={42} />
            <p className="text-sm text-neutral-500">
              No waiter orders for this filter.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}