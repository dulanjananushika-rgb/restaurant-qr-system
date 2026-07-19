"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  ReceiptText,
  RefreshCw,
  Smartphone,
  UtensilsCrossed,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

/* =========================
   Types
========================= */

type PaymentMethod =
  | "CASH"
  | "CARD"
  | "ONLINE";

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

  menuItem?: MenuItemData | null;

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
  } | null;

  quantity: number;
  price: number;
  originalPrice: number;

  comboItemsSnapshot?: ComboSnapshotItem[];
};

type Order = {
  _id: string;

  table?: TableData | null;

  orderType:
    | "DINE_IN"
    | "TAKE_AWAY"
    | "ONLINE";

  customerName?: string;
  customerPhone?: string;

  items: OrderItem[];
  comboItems?: ComboItem[];

  totalAmount: number;

  status:
    | "PENDING"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "DELIVERED"
    | "CANCELLED";

  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "PARTIALLY_PAID";

  paymentType:
    | "PAY_NOW"
    | "PAY_LATER";

  createdAt: string;
};

type SessionBill = {
  diningSessionId: string;

  table?: TableData | null;

  orders: Order[];

  totalAmount: number;
  allDelivered: boolean;
  createdAt: string;
};

type PaymentOrderReference =
  | string
  | {
      _id: string;
      table?: TableData | null;
    };

type DiningSessionReference =
  | string
  | {
      _id: string;
      table?: TableData | null;
    };

type Payment = {
  _id: string;

  order?: PaymentOrderReference | null;
  orders?: PaymentOrderReference[];

  diningSession?: DiningSessionReference | null;

  amount: number;
  method: PaymentMethod;
  status: string;

  paidAt?: string;
  createdAt?: string;

  note?: string;
};

type PaymentResponse = {
  success: boolean;
  message?: string;

  data?: {
    paymentId: string;

    orderId?: string;
    diningSessionId?: string;

    orderIds?: string[];
    orderCount?: number;

    amount: number;
    method: PaymentMethod;
    paymentStatus: "PAID";

    receiptUrl?: string;
  };
};

/* =========================
   Helpers
========================= */

function formatCurrency(amount: number) {
  return `Rs. ${Number(
    amount || 0
  ).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function methodIcon(
  method: PaymentMethod
) {
  if (method === "CASH") {
    return Banknote;
  }

  if (method === "CARD") {
    return CreditCard;
  }

  return Smartphone;
}

function getOrderNumber(
  orderId: string
) {
  return orderId
    .slice(-6)
    .toUpperCase();
}

function getReferenceId(
  reference?:
    | PaymentOrderReference
    | DiningSessionReference
    | null
) {
  if (!reference) {
    return "";
  }

  if (typeof reference === "string") {
    return reference;
  }

  return reference._id || "";
}

function getPaymentOrderCount(
  payment: Payment
) {
  if (
    Array.isArray(payment.orders) &&
    payment.orders.length > 0
  ) {
    return payment.orders.length;
  }

  return payment.order ? 1 : 0;
}

/* =========================
   Main component
========================= */

export default function CashierPaymentManager({
  sessionBills,
  singleOrders,
  payments,
}: {
  sessionBills: SessionBill[];
  singleOrders: Order[];
  payments: Payment[];
}) {
  const router = useRouter();

  const [
    selectedMethods,
    setSelectedMethods,
  ] = useState<
    Record<string, PaymentMethod>
  >({});

  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const [loadingKey, setLoadingKey] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [receiptUrl, setReceiptUrl] =
    useState("");

  const [
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  ] = useState(true);

  /* =========================
     Automatic refresh
  ========================= */

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const intervalId =
      window.setInterval(() => {
        router.refresh();
      }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, router]);

  /* =========================
     Payment request
  ========================= */

  async function submitPayment({
    key,
    payload,
    confirmation,
  }: {
    key: string;

    payload: {
      orderId?: string;
      diningSessionId?: string;
    };

    confirmation: string;
  }) {
    const confirmed =
      window.confirm(confirmation);

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setReceiptUrl("");
    setLoadingKey(key);

    const paymentMethod =
      selectedMethods[key] || "CASH";

    try {
      const response = await fetch(
        "/api/cashier/payments",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            ...payload,

            method: paymentMethod,

            note:
              notes[key]?.trim() || "",
          }),
        }
      );

      const result =
        (await response
          .json()
          .catch(() => ({
            success: false,
            message:
              "The server returned an invalid response.",
          }))) as PaymentResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ||
            "Failed to settle the payment."
        );
      }

      setSuccess(
        result.message ||
          "Payment settled successfully."
      );

      setReceiptUrl(
        result.data?.receiptUrl || ""
      );

      setNotes((current) => {
        const updated = {
          ...current,
        };

        delete updated[key];

        return updated;
      });

      router.refresh();
    } catch (paymentError) {
      console.error(
        "Payment settlement error:",
        paymentError
      );

      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Failed to settle the payment."
      );
    } finally {
      setLoadingKey("");
    }
  }

  /* =========================
     Payment input controls
  ========================= */

  function renderMethodAndNote(
    key: string,
    disabled: boolean
  ) {
    return (
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`method-${key}`}
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Payment Method
          </label>

          <select
            id={`method-${key}`}
            value={
              selectedMethods[key] ||
              "CASH"
            }
            disabled={disabled}
            onChange={(event) =>
              setSelectedMethods(
                (current) => ({
                  ...current,

                  [key]:
                    event.target
                      .value as PaymentMethod,
                })
              )
            }
            className="w-full rounded-xl border border-white/10 bg-[#0b0f14] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="CASH">
              Cash
            </option>

            <option value="CARD">
              Card
            </option>

            <option value="ONLINE">
              Online
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`note-${key}`}
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Payment Note
          </label>

          <input
            id={`note-${key}`}
            type="text"
            value={notes[key] || ""}
            disabled={disabled}
            maxLength={500}
            placeholder="Cash received or card reference"
            onChange={(event) =>
              setNotes((current) => ({
                ...current,

                [key]:
                  event.target.value,
              }))
            }
            className="w-full rounded-xl border border-white/10 bg-[#0b0f14] px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    );
  }

  /* =========================
     Order items
  ========================= */

  function renderOrderItems(
    order: Order
  ) {
    const hasItems =
      Array.isArray(order.items) &&
      order.items.length > 0;

    const hasCombos =
      Array.isArray(
        order.comboItems
      ) &&
      order.comboItems.length > 0;

    return (
      <div className="mt-3 space-y-2">
        {order.items?.map((item) => (
          <div
            key={item._id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-neutral-400">
              {item.menuItem?.name ||
                "Menu item"}{" "}
              × {item.quantity}
            </span>

            <span className="font-medium text-white">
              {formatCurrency(
                item.price *
                  item.quantity
              )}
            </span>
          </div>
        ))}

        {order.comboItems?.map(
          (combo) => (
            <div
              key={combo._id}
              className="rounded-lg border border-amber-500/10 bg-amber-500/[0.04] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-amber-200">
                  {combo.comboOffer?.name ||
                    "Combo offer"}{" "}
                  × {combo.quantity}
                </span>

                <span className="font-medium text-white">
                  {formatCurrency(
                    combo.price *
                      combo.quantity
                  )}
                </span>
              </div>

              {combo
                .comboItemsSnapshot &&
                combo
                  .comboItemsSnapshot
                  .length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-neutral-500">
                    {combo.comboItemsSnapshot.map(
                      (
                        snapshot,
                        index
                      ) => (
                        <p
                          key={`${combo._id}-${index}`}
                        >
                          • {snapshot.name} ×{" "}
                          {snapshot.quantity}
                        </p>
                      )
                    )}
                  </div>
                )}
            </div>
          )
        )}

        {!hasItems && !hasCombos && (
          <p className="text-sm text-neutral-500">
            No order items were found.
          </p>
        )}
      </div>
    );
  }

  /* =========================
     UI
  ========================= */

  return (
    <section className="space-y-8">
      {/* Live refresh controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">
            Cashier live screen
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            Bills and payment history refresh
            every five seconds.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              router.refresh()
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-neutral-300 transition hover:border-white/20 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </button>

          <button
            type="button"
            onClick={() =>
              setAutoRefreshEnabled(
                (current) => !current
              )
            }
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              autoRefreshEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-black/20 text-neutral-400"
            }`}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                autoRefreshEnabled
                  ? "animate-spin"
                  : ""
              }`}
            />

            {autoRefreshEnabled
              ? "Auto Refresh ON"
              : "Auto Refresh OFF"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {/* Success and receipt */}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

            <div>
              <p className="text-sm text-emerald-200">
                {success}
              </p>

              {receiptUrl && (
                <Link
                  href={receiptUrl}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black transition hover:bg-neutral-200"
                >
                  <ReceiptText className="h-4 w-4" />

                  View and Print Receipt
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================
          Combined table bills
      ====================== */}

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">
            Combined Table Bills
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            All unpaid orders from the same
            dining session are displayed as
            one final table bill.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {sessionBills.map((bill) => {
            const key =
              `session:${bill.diningSessionId}`;

            const isLoading =
              loadingKey === key;

            return (
              <article
                key={
                  bill.diningSessionId
                }
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5"
              >
                {/* Bill heading */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      Combined Dining Bill
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-white">
                      {bill.table?.name ||
                        "Dining Table"}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      {bill.orders.length}{" "}
                      {bill.orders.length === 1
                        ? "order"
                        : "orders"}{" "}
                      in this dining session
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs text-neutral-500">
                      Combined Total
                    </p>

                    <p className="mt-1 text-2xl font-bold text-emerald-200">
                      {formatCurrency(
                        bill.totalAmount
                      )}
                    </p>
                  </div>
                </div>

                {/* Orders inside session */}
                <div className="mt-5 space-y-4">
                  {bill.orders.map(
                    (order) => (
                      <div
                        key={order._id}
                        className="rounded-xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              Order #
                              {getOrderNumber(
                                order._id
                              )}
                            </p>

                            <p className="mt-1 text-xs text-neutral-500">
                              {formatDateTime(
                                order.createdAt
                              )}
                            </p>

                            {(order.customerName ||
                              order.customerPhone) && (
                              <p className="mt-2 text-xs text-neutral-500">
                                Customer:{" "}
                                {order.customerName ||
                                  "N/A"}

                                {order.customerPhone
                                  ? ` • ${order.customerPhone}`
                                  : ""}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                order.status ===
                                "DELIVERED"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              }`}
                            >
                              {order.status.replaceAll(
                                "_",
                                " "
                              )}
                            </span>

                            <p className="mt-2 font-semibold text-white">
                              {formatCurrency(
                                order.totalAmount
                              )}
                            </p>
                          </div>
                        </div>

                        {renderOrderItems(
                          order
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Delivery warning */}
                {!bill.allDelivered && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-4 text-sm text-amber-200">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />

                    <p>
                      All orders from this
                      table must be delivered
                      before settling the final
                      combined bill.
                    </p>
                  </div>
                )}

                {renderMethodAndNote(
                  key,
                  isLoading ||
                    !bill.allDelivered
                )}

                <button
                  type="button"
                  disabled={
                    isLoading ||
                    !bill.allDelivered
                  }
                  onClick={() =>
                    void submitPayment({
                      key,

                      payload: {
                        diningSessionId:
                          bill.diningSessionId,
                      },

                      confirmation:
                        `Settle the combined bill for ` +
                        `${bill.table?.name || "this table"}?\n\n` +
                        `${bill.orders.length} orders\n` +
                        `${formatCurrency(bill.totalAmount)}`,
                    })
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <UtensilsCrossed className="h-5 w-5" />
                  )}

                  {isLoading
                    ? "Settling Combined Bill..."
                    : bill.allDelivered
                      ? "Settle Combined Bill"
                      : "Waiting for Delivery"}
                </button>
              </article>
            );
          })}

          {sessionBills.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500 xl:col-span-2">
              No unpaid combined table bills
              are available.
            </div>
          )}
        </div>
      </div>

      {/* =====================
          Individual orders
      ====================== */}

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">
            Individual Orders
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Takeaway orders and older dine-in
            orders without a dining session
            are settled individually.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {singleOrders.map((order) => {
            const key =
              `order:${order._id}`;

            const isLoading =
              loadingKey === key;

            const canSettle =
              order.orderType !==
                "DINE_IN" ||
              order.status ===
                "DELIVERED";

            return (
              <article
                key={order._id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                      {order.orderType ===
                      "TAKE_AWAY"
                        ? "Takeaway Order"
                        : order.orderType ===
                            "ONLINE"
                          ? "Online Order"
                          : "Legacy Dine-in Order"}
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-white">
                      Order #
                      {getOrderNumber(
                        order._id
                      )}
                    </h3>

                    <p className="mt-1 text-sm text-neutral-500">
                      {order.table?.name ||
                        "Counter Pickup"}
                    </p>

                    <p className="mt-1 text-xs text-neutral-600">
                      {formatDateTime(
                        order.createdAt
                      )}
                    </p>
                  </div>

                  <p className="text-xl font-bold text-white">
                    {formatCurrency(
                      order.totalAmount
                    )}
                  </p>
                </div>

                {(order.customerName ||
                  order.customerPhone) && (
                  <p className="mt-3 text-sm text-neutral-400">
                    Customer:{" "}
                    {order.customerName ||
                      "N/A"}

                    {order.customerPhone
                      ? ` • ${order.customerPhone}`
                      : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-neutral-300">
                    {order.status.replaceAll(
                      "_",
                      " "
                    )}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-neutral-300">
                    {order.paymentStatus.replaceAll(
                      "_",
                      " "
                    )}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-neutral-300">
                    {order.paymentType.replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </div>

                {renderOrderItems(order)}

                {!canSettle && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-200">
                    Deliver this dine-in order
                    before settling payment.
                  </div>
                )}

                {renderMethodAndNote(
                  key,
                  isLoading ||
                    !canSettle
                )}

                <button
                  type="button"
                  disabled={
                    isLoading ||
                    !canSettle
                  }
                  onClick={() =>
                    void submitPayment({
                      key,

                      payload: {
                        orderId:
                          order._id,
                      },

                      confirmation:
                        `Settle Order #${getOrderNumber(order._id)} ` +
                        `for ${formatCurrency(order.totalAmount)}?`,
                    })
                  }
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Banknote className="h-5 w-5" />
                  )}

                  {isLoading
                    ? "Settling..."
                    : "Settle Payment"}
                </button>
              </article>
            );
          })}

          {singleOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500 xl:col-span-2">
              No unpaid individual orders are
              available.
            </div>
          )}
        </div>
      </div>

      {/* =====================
          Recent payments
      ====================== */}

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">
            Recent Payments
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Latest individual and combined
            payment records.
          </p>
        </div>

        <div className="space-y-3">
          {payments.map((payment) => {
            const Icon = methodIcon(
              payment.method
            );

            const sessionId =
              getReferenceId(
                payment.diningSession
              );

            const singleOrderId =
              getReferenceId(
                payment.order
              );

            const orderCount =
              getPaymentOrderCount(
                payment
              );

            const isCombined =
              Boolean(sessionId) ||
              orderCount > 1;

            const paymentDate =
              payment.paidAt ||
              payment.createdAt ||
              "";

            return (
              <div
                key={payment._id}
                className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="font-semibold text-white">
                      {formatCurrency(
                        payment.amount
                      )}
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      {payment.method} •{" "}
                      {payment.status}
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      {isCombined
                        ? `${orderCount} order combined bill`
                        : singleOrderId
                          ? `Order #${getOrderNumber(singleOrderId)}`
                          : "Payment record"}
                    </p>

                    <p className="mt-1 text-xs text-neutral-600">
                      {formatDateTime(
                        paymentDate
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  <div className="flex flex-wrap items-center gap-3">
                    {singleOrderId && (
                      <Link
                        href={`/cashier/receipt/${singleOrderId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-white/20"
                      >
                        <ReceiptText className="h-4 w-4" />

                        Receipt
                      </Link>
                    )}

                    {sessionId && (
                      <Link
                        href={`/cashier/receipt/session/${sessionId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-500/[0.12]"
                      >
                        <ReceiptText className="h-4 w-4" />

                        Combined Receipt
                      </Link>
                    )}
                  </div>

                  {payment.note && (
                    <p className="max-w-sm text-xs text-neutral-500">
                      Note: {payment.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {payments.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500">
              No payments have been recorded.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}