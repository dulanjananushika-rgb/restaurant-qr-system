"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
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
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY";
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
  acceptedAt?: string | null;
  preparingStartedAt?: string | null;
  readyAt?: string | null;
  statusHistory?: StatusHistoryItem[];
};

function statusClass(status: string) {
  if (status === "PENDING") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (status === "ACCEPTED") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }

  if (status === "PREPARING") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  }

  if (status === "READY") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-300";
}

function orderTypeClass(orderType?: string) {
  if (orderType === "TAKE_AWAY") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  }

  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
}

function getNextAction(status: string) {
  if (status === "PENDING") {
    return {
      nextStatus: "ACCEPTED",
      label: "Accept order",
      icon: CheckCircle2,
    };
  }

  if (status === "ACCEPTED") {
    return {
      nextStatus: "PREPARING",
      label: "Start preparing",
      icon: ChefHat,
    };
  }

  if (status === "PREPARING") {
    return {
      nextStatus: "READY",
      label: "Mark ready",
      icon: PackageCheck,
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
  const createdMinutes = getElapsedMinutes(order.createdAt);
  const preparingMinutes = getElapsedMinutes(
    order.preparingStartedAt,
    order.readyAt
  );

  if (order.status === "PENDING" && createdMinutes !== null) {
    if (createdMinutes >= 10) return "CRITICAL";
    if (createdMinutes >= 5) return "WARNING";
  }

  if (order.status === "PREPARING" && preparingMinutes !== null) {
    if (preparingMinutes >= 20) return "CRITICAL";
    if (preparingMinutes >= 12) return "WARNING";
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

function getOrderLocation(order: Order) {
  if (order.orderType === "TAKE_AWAY") {
    return "Counter pickup";
  }

  return order.table?.name || "No table";
}

function getOrderTypeLabel(orderType?: string) {
  if (orderType === "TAKE_AWAY") return "TAKEAWAY";
  if (orderType === "ONLINE") return "ONLINE";

  return "DINE-IN";
}

export default function KitchenOrderManager({ orders }: { orders: Order[] }) {
  const router = useRouter();

  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "PENDING" | "ACCEPTED" | "PREPARING" | "READY"
  >("ALL");
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

  async function updateKitchenStatus(orderId: string, status: string) {
    setError("");
    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(`/api/kitchen/orders/${orderId}`, {
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
        setError(result.message || "Failed to update kitchen order");
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
            <p className="text-sm font-semibold">Kitchen live screen</p>
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            Simple order view. Extra time and history details are inside View
            Details.
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
        {["ALL", "PENDING", "ACCEPTED", "PREPARING", "READY"].map((status) => (
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

      <section className="grid gap-4 xl:grid-cols-2">
        {filteredOrders.map((order) => {
          const nextAction = getNextAction(order.status);
          const ActionIcon = nextAction?.icon;
          const delayLevel = getDelayLevel(order);
          const isExpanded = expandedOrders[order._id] || false;

          const cookingMinutes = getElapsedMinutes(
            order.preparingStartedAt,
            order.readyAt
          );

          const waitingMinutes = getElapsedMinutes(order.createdAt);

          return (
            <article
              key={order._id}
              className={`flex h-full flex-col rounded-[26px] border p-5 transition ${delayCardClass(
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

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left sm:text-right">
                  <p className="text-xs text-neutral-500">Kitchen Status</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-300">
                    {order.status}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Utensils size={17} className="text-emerald-300" />
                    <h3 className="text-sm font-semibold">Menu Items</h3>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {order.items?.map((item) => (
                      <div
                        key={item._id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <p className="text-sm">
                          {item.menuItem?.name || "Menu item"}
                        </p>

                        <p className="text-sm font-semibold">
                          × {item.quantity}
                        </p>
                      </div>
                    ))}

                    {(!order.items || order.items.length === 0) && (
                      <p className="text-sm text-neutral-500">
                        No normal menu items.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ReceiptText size={17} className="text-amber-300" />
                    <h3 className="text-sm font-semibold">Combo Items</h3>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {order.comboItems?.map((combo) => (
                      <div
                        key={combo._id}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-emerald-100">
                            {combo.comboOffer?.name || "Combo offer"}
                          </p>

                          <p className="text-sm font-semibold">
                            × {combo.quantity}
                          </p>
                        </div>

                        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                          {combo.comboItemsSnapshot?.map((snapshot, index) => (
                            <p
                              key={`${combo._id}-${index}`}
                              className="text-xs text-neutral-400"
                            >
                              • {snapshot.name} ×{" "}
                              {snapshot.quantity * combo.quantity}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}

                    {(!order.comboItems || order.comboItems.length === 0) && (
                      <p className="text-sm text-neutral-500">
                        No combo items.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {isExpanded && (
                <section className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock size={17} className="text-sky-300" />
                    <h3 className="text-sm font-semibold">Order Details</h3>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Created</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Waiting Time</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {getElapsedText(waitingMinutes)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Cooking Time</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {getElapsedText(cookingMinutes)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Accepted</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.acceptedAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Preparing</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.preparingStartedAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-neutral-500">Ready</p>
                      <p className="mt-1 text-xs text-neutral-300">
                        {formatDateTime(order.readyAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 flex items-center gap-2">
                      <History size={17} className="text-sky-300" />
                      <h3 className="text-sm font-semibold">Status History</h3>
                    </div>

                    <div className="space-y-2">
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
                                By {history.changedByName || "Kitchen staff"}{" "}
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

              <div className="mt-auto space-y-3 pt-5">
                {nextAction && (
                  <label className="block">
                    <span className="mb-2 block text-xs text-neutral-500">
                      Kitchen note optional
                    </span>

                    <input
                      value={notes[order._id] || ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [order._id]: event.target.value,
                        }))
                      }
                      placeholder="Example: Started preparation / item is almost ready"
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
                        updateKitchenStatus(order._id, nextAction.nextStatus)
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
                      Ready for pickup
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleDetails(order._id)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white"
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
            <ChefHat className="mx-auto mb-3 text-neutral-600" size={42} />
            <p className="text-sm text-neutral-500">
              No kitchen orders for this filter.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}