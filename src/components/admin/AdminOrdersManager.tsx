"use client";

import { useRouter } from "next/navigation";
import {
  Clock,
  CreditCard,
  History,
  PackageCheck,
  ReceiptText,
  Timer,
} from "lucide-react";
import { useState } from "react";

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
  menuItem?: string;
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
  acceptedAt?: string | null;
  preparingStartedAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  statusHistory?: StatusHistoryItem[];
};

function statusClass(status: string) {
  if (
    status === "PAID" ||
    status === "DELIVERED" ||
    status === "READY" ||
    status === "PICKED_UP"
  ) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "PENDING" || status === "UNPAID") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (status === "PREPARING") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  }

  return "border-sky-500/20 bg-sky-500/10 text-sky-300";
}

function formatDateTime(date?: string | null) {
  if (!date) return "Not set";
  return new Date(date).toLocaleString();
}

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

function getElapsedMinutes(fromDate?: string | null, toDate?: string | null) {
  if (!fromDate) return "Not started";

  const start = new Date(fromDate).getTime();
  const end = toDate ? new Date(toDate).getTime() : Date.now();

  const diffMs = Math.max(end - start, 0);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "Less than 1 min";
  if (minutes === 1) return "1 min";

  return `${minutes} mins`;
}

export default function AdminOrdersManager({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState("");

  async function updateOrder(
    orderId: string,
    data: {
      status?: string;
      paymentStatus?: string;
    }
  ) {
    setUpdatingId(orderId);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Failed to update order");
        return;
      }

      router.refresh();
    } catch {
      alert("Something went wrong while updating order.");
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const normalItemGroups = order.items?.length || 0;
        const comboItemGroups = order.comboItems?.length || 0;

        const cookingTime = getElapsedMinutes(
          order.preparingStartedAt,
          order.readyAt
        );

        return (
          <article
            key={order._id}
            className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
              <div>
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
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                      order.paymentStatus
                    )}`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} />
                    {new Date(order.createdAt).toLocaleString()}
                  </span>

                  <span>{order.table?.name || "No table"}</span>

                  <span>{order.paymentType}</span>

                  <span>
                    {normalItemGroups + comboItemGroups} item group(s)
                  </span>
                </div>

                {(order.customerName || order.customerPhone) && (
                  <p className="mt-2 text-sm text-neutral-400">
                    Customer: {order.customerName || "N/A"}{" "}
                    {order.customerPhone ? `• ${order.customerPhone}` : ""}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                <p className="text-xs text-neutral-500">Total Amount</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-300">
                  {formatCurrency(order.totalAmount)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Timer size={18} className="text-purple-300" />
                  <h3 className="text-sm font-semibold">Kitchen Progress</h3>
                </div>

                <p className="text-sm font-medium text-purple-300">
                  Cooking Time: {cookingTime}
                </p>

                <div className="mt-3 space-y-1 text-xs text-neutral-500">
                  <p>Accepted: {formatDateTime(order.acceptedAt)}</p>
                  <p>Preparing: {formatDateTime(order.preparingStartedAt)}</p>
                  <p>Ready: {formatDateTime(order.readyAt)}</p>
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock size={18} className="text-sky-300" />
                  <h3 className="text-sm font-semibold">Service Times</h3>
                </div>

                <div className="space-y-1 text-xs text-neutral-500">
                  <p>Picked Up: {formatDateTime(order.pickedUpAt)}</p>
                  <p>Delivered: {formatDateTime(order.deliveredAt)}</p>
                  <p>Cancelled: {formatDateTime(order.cancelledAt)}</p>
                </div>
              </section>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ReceiptText size={18} className="text-emerald-300" />
                  <h3 className="text-sm font-semibold">Menu Items</h3>
                </div>

                <div className="space-y-2">
                  {order.items?.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
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

                  {normalItemGroups === 0 && (
                    <p className="text-sm text-neutral-500">
                      No normal menu items.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PackageCheck size={18} className="text-amber-300" />
                  <h3 className="text-sm font-semibold">Combo Items</h3>
                </div>

                <div className="space-y-3">
                  {order.comboItems?.map((combo) => (
                    <div
                      key={combo._id}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-emerald-200">
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

                      <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                        {combo.comboItemsSnapshot?.map((snapshot, index) => (
                          <p
                            key={`${combo._id}-${index}`}
                            className="text-xs text-neutral-400"
                          >
                            • {snapshot.name} × {snapshot.quantity}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {comboItemGroups === 0 && (
                    <p className="text-sm text-neutral-500">No combo items.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <History size={18} className="text-sky-300" />
                <h3 className="text-sm font-semibold">Status History</h3>
              </div>

              <div className="space-y-2">
                {order.statusHistory && order.statusHistory.length > 0 ? (
                  order.statusHistory
                    .slice()
                    .reverse()
                    .map((history, index) => (
                      <div
                        key={history._id || `${order._id}-history-${index}`}
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
                          • {new Date(history.changedAt).toLocaleString()}
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

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs text-neutral-500">
                  Order Status
                </span>

                <select
                  value={order.status}
                  disabled={updatingId === order._id}
                  onChange={(event) =>
                    updateOrder(order._id, { status: event.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                >
                  <option className="bg-[#0B0F14]" value="PENDING">
                    PENDING
                  </option>
                  <option className="bg-[#0B0F14]" value="ACCEPTED">
                    ACCEPTED
                  </option>
                  <option className="bg-[#0B0F14]" value="PREPARING">
                    PREPARING
                  </option>
                  <option className="bg-[#0B0F14]" value="READY">
                    READY
                  </option>
                  <option className="bg-[#0B0F14]" value="PICKED_UP">
                    PICKED_UP
                  </option>
                  <option className="bg-[#0B0F14]" value="DELIVERED">
                    DELIVERED
                  </option>
                  <option className="bg-[#0B0F14]" value="CANCELLED">
                    CANCELLED
                  </option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs text-neutral-500">
                  Payment Status
                </span>

                <select
                  value={order.paymentStatus}
                  disabled={updatingId === order._id}
                  onChange={(event) =>
                    updateOrder(order._id, {
                      paymentStatus: event.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                >
                  <option className="bg-[#0B0F14]" value="UNPAID">
                    UNPAID
                  </option>
                  <option className="bg-[#0B0F14]" value="PENDING">
                    PENDING
                  </option>
                  <option className="bg-[#0B0F14]" value="PAID">
                    PAID
                  </option>
                  <option className="bg-[#0B0F14]" value="FAILED">
                    FAILED
                  </option>
                  <option className="bg-[#0B0F14]" value="PARTIALLY_PAID">
                    PARTIALLY_PAID
                  </option>
                </select>
              </label>
            </div>

            {updatingId === order._id && (
              <p className="mt-3 text-xs text-amber-300">Updating order...</p>
            )}
          </article>
        );
      })}

      {orders.length === 0 && (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-10 text-center">
          <CreditCard className="mx-auto mb-3 text-neutral-600" size={36} />
          <p className="text-sm text-neutral-500">No orders found.</p>
        </div>
      )}
    </div>
  );
}