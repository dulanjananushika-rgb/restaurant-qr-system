"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";

type PaymentMethod = "CASH" | "CARD";

type OrderItem = {
  _id?: string;

  menuItem?: {
    _id: string;
    name: string;
  } | null;

  quantity: number;
  price: number;
};

type ComboOrderItem = {
  _id?: string;

  comboOffer?: {
    _id: string;
    name: string;
  } | null;

  quantity: number;
  price: number;
};

type TakeawayOrder = {
  _id: string;

  orderType: "TAKE_AWAY";

  customerName: string;
  customerPhone?: string;

  items: OrderItem[];
  comboItems: ComboOrderItem[];

  totalAmount: number;

  status:
    | "PENDING"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "CANCELLED";

  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "PARTIALLY_PAID";

  paymentType: "PAY_NOW" | "PAY_LATER";

  createdAt: string;
  acceptedAt?: string | null;
  preparingStartedAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
};

type CollectionResponse = {
  success: boolean;
  message?: string;

  data?: {
    orderId: string;
    pickupNumber: string;
    orderStatus: "PICKED_UP";
    displayStatus: "COLLECTED";
    paymentStatus: "PAID";
    paymentMethod: PaymentMethod | null;
    totalAmount: number;
    collectedAt: string;
    paymentId: string | null;
    receiptUrl: string;
  };
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPickupNumber(orderId: string) {
  return orderId.slice(-6).toUpperCase();
}

function getKitchenStatusLabel(status: TakeawayOrder["status"]) {
  if (status === "PENDING") {
    return "Waiting for Kitchen";
  }

  if (status === "ACCEPTED") {
    return "Accepted";
  }

  if (status === "PREPARING") {
    return "Preparing";
  }

  if (status === "READY") {
    return "Ready";
  }

  if (status === "PICKED_UP") {
    return "Collected";
  }

  return status.replaceAll("_", " ");
}

export default function TakeawayPickupManager({
  orders,
}: {
  orders: TakeawayOrder[];
}) {
  const router = useRouter();

  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, PaymentMethod>
  >({});

  const [paymentNotes, setPaymentNotes] = useState<
    Record<string, string>
  >({});

  const [processingOrderId, setProcessingOrderId] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [receiptUrl, setReceiptUrl] = useState<string | null>(
    null
  );

  const kitchenOrders = useMemo(() => {
    return orders.filter((order) =>
      ["PENDING", "ACCEPTED", "PREPARING"].includes(
        order.status
      )
    );
  }, [orders]);

  const awaitingPaymentOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        order.status === "READY" &&
        order.paymentStatus !== "PAID"
    );
  }, [orders]);

  const paidReadyOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        order.status === "READY" &&
        order.paymentStatus === "PAID"
    );
  }, [orders]);

  const collectedOrders = useMemo(() => {
    return orders
      .filter((order) => order.status === "PICKED_UP")
      .slice(0, 20);
  }, [orders]);

  /*
   * Refresh the server data automatically.
   * This allows kitchen status changes to appear
   * on the cashier page without a manual reload.
   */
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [router]);

  function refreshOrders() {
    setRefreshing(true);

    router.refresh();

    window.setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }

  async function collectOrder(order: TakeawayOrder) {
    try {
      setProcessingOrderId(order._id);
      setError("");
      setSuccessMessage("");
      setReceiptUrl(null);

      const isPaid = order.paymentStatus === "PAID";

      const selectedPaymentMethod =
        paymentMethods[order._id] || "CASH";

      const response = await fetch(
        `/api/cashier/takeaway-orders/${order._id}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            paymentMethod: isPaid
              ? undefined
              : selectedPaymentMethod,

            note:
              paymentNotes[order._id]?.trim() || "",
          }),
        }
      );

      const result: CollectionResponse =
        await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ||
            "Failed to complete takeaway order."
        );
      }

      setSuccessMessage(
        result.message ||
          `Takeaway Order #${result.data.pickupNumber} completed successfully.`
      );

      setReceiptUrl(result.data.receiptUrl);

      setPaymentNotes((current) => {
        const updated = { ...current };
        delete updated[order._id];
        return updated;
      });

      router.refresh();
    } catch (collectionError) {
      console.error(
        "Complete takeaway order error:",
        collectionError
      );

      setError(
        collectionError instanceof Error
          ? collectionError.message
          : "Failed to complete takeaway order."
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  function renderOrderItems(order: TakeawayOrder) {
    return (
      <div className="mt-4 space-y-2">
        {order.items.map((item, index) => (
          <div
            key={item._id || `item-${index}`}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-neutral-300">
              {item.menuItem?.name || "Menu Item"} ×{" "}
              {item.quantity}
            </span>

            <span className="font-medium text-white">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        ))}

        {order.comboItems.map((item, index) => (
          <div
            key={item._id || `combo-${index}`}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-amber-200">
              {item.comboOffer?.name || "Combo Offer"} ×{" "}
              {item.quantity}
            </span>

            <span className="font-medium text-white">
              {formatCurrency(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function renderCustomerDetails(order: TakeawayOrder) {
    return (
      <div className="mt-3 space-y-1 text-sm text-neutral-400">
        <p>
          Customer:{" "}
          <strong className="text-white">
            {order.customerName || "Walk-in Customer"}
          </strong>
        </p>

        {order.customerPhone && (
          <p>
            Phone:{" "}
            <strong className="text-white">
              {order.customerPhone}
            </strong>
          </p>
        )}

        <p>
          Created:{" "}
          <strong className="text-white">
            {formatDateTime(order.createdAt)}
          </strong>
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Pickup Management
          </p>

          <h2 className="mt-1 text-2xl font-bold text-white">
            Takeaway Order Status
          </h2>

          <p className="mt-2 text-sm text-neutral-400">
            Monitor kitchen progress, receive payment and hand
            prepared orders to customers.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshOrders}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/20 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />

            <div>
              <p className="text-sm font-medium text-emerald-200">
                {successMessage}
              </p>

              {receiptUrl && (
                <Link
                  href={receiptUrl}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black"
                >
                  <ReceiptText className="h-4 w-4" />
                  View / Print Receipt
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] p-5">
          <UtensilsCrossed className="h-5 w-5 text-sky-300" />

          <p className="mt-3 text-sm text-sky-200">
            In Kitchen
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {kitchenOrders.length}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
          <Banknote className="h-5 w-5 text-amber-300" />

          <p className="mt-3 text-sm text-amber-200">
            Awaiting Payment
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {awaitingPaymentOrders.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
          <PackageCheck className="h-5 w-5 text-emerald-300" />

          <p className="mt-3 text-sm text-emerald-200">
            Ready and Paid
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {paidReadyOrders.length}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-5">
          <ShoppingBag className="h-5 w-5 text-violet-300" />

          <p className="mt-3 text-sm text-violet-200">
            Collected
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {collectedOrders.length}
          </p>
        </div>
      </div>

      {/* In kitchen */}
      <div>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-white">
            In Kitchen
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            Orders currently waiting, accepted or preparing.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {kitchenOrders.map((order) => (
            <article
              key={order._id}
              className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                    Pickup #{getPickupNumber(order._id)}
                  </p>

                  <h4 className="mt-2 text-lg font-semibold text-white">
                    {order.customerName}
                  </h4>
                </div>

                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  {getKitchenStatusLabel(order.status)}
                </span>
              </div>

              {renderCustomerDetails(order)}
              {renderOrderItems(order)}

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-sm text-neutral-400">
                  Total
                </span>

                <strong className="text-lg text-white">
                  {formatCurrency(order.totalAmount)}
                </strong>
              </div>
            </article>
          ))}

          {kitchenOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500 lg:col-span-2">
              No takeaway orders are currently in the kitchen.
            </div>
          )}
        </div>
      </div>

      {/* Awaiting payment */}
      <div>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-white">
            Awaiting Payment
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            These orders are ready. Receive full payment before
            handing them to the customer.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {awaitingPaymentOrders.map((order) => {
            const isProcessing =
              processingOrderId === order._id;

            const selectedMethod =
              paymentMethods[order._id] || "CASH";

            return (
              <article
                key={order._id}
                className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                      Pickup #{getPickupNumber(order._id)}
                    </p>

                    <h4 className="mt-2 text-lg font-semibold text-white">
                      {order.customerName}
                    </h4>
                  </div>

                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    Payment Required
                  </span>
                </div>

                {renderCustomerDetails(order)}
                {renderOrderItems(order)}

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-sm text-neutral-400">
                    Amount Due
                  </span>

                  <strong className="text-xl text-amber-200">
                    {formatCurrency(order.totalAmount)}
                  </strong>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() =>
                      setPaymentMethods((current) => ({
                        ...current,
                        [order._id]: "CASH",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                      selectedMethod === "CASH"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-white/10 bg-black/20 text-neutral-400"
                    }`}
                  >
                    <Banknote className="h-4 w-4" />
                    Cash
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() =>
                      setPaymentMethods((current) => ({
                        ...current,
                        [order._id]: "CARD",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                      selectedMethod === "CARD"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-white/10 bg-black/20 text-neutral-400"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    Card
                  </button>
                </div>

                <input
                  type="text"
                  value={paymentNotes[order._id] || ""}
                  disabled={isProcessing}
                  maxLength={300}
                  onChange={(event) =>
                    setPaymentNotes((current) => ({
                      ...current,
                      [order._id]: event.target.value,
                    }))
                  }
                  placeholder="Payment note or card reference (optional)"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-400 disabled:opacity-60"
                />

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void collectOrder(order)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Banknote className="h-5 w-5" />
                  )}

                  Pay Full Amount & Mark Collected
                </button>
              </article>
            );
          })}

          {awaitingPaymentOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500 lg:col-span-2">
              No ready takeaway orders are awaiting payment.
            </div>
          )}
        </div>
      </div>

      {/* Paid and ready */}
      <div>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-white">
            Ready for Pickup
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            These orders are already paid and can be handed to
            the customer.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {paidReadyOrders.map((order) => {
            const isProcessing =
              processingOrderId === order._id;

            return (
              <article
                key={order._id}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      Pickup #{getPickupNumber(order._id)}
                    </p>

                    <h4 className="mt-2 text-lg font-semibold text-white">
                      {order.customerName}
                    </h4>
                  </div>

                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Paid
                  </span>
                </div>

                {renderCustomerDetails(order)}
                {renderOrderItems(order)}

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-sm text-neutral-400">
                    Total Paid
                  </span>

                  <strong className="text-xl text-emerald-200">
                    {formatCurrency(order.totalAmount)}
                  </strong>
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void collectOrder(order)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60"
                >
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <PackageCheck className="h-5 w-5" />
                  )}

                  Hand Over & Mark Collected
                </button>
              </article>
            );
          })}

          {paidReadyOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500 lg:col-span-2">
              No paid takeaway orders are currently ready.
            </div>
          )}
        </div>
      </div>

      {/* Collected */}
      <div>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-white">
            Recently Collected
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            Latest completed takeaway orders.
          </p>
        </div>

        <div className="space-y-3">
          {collectedOrders.map((order) => (
            <div
              key={order._id}
              className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-white">
                  #{getPickupNumber(order._id)} —{" "}
                  {order.customerName}
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Collected:{" "}
                  {formatDateTime(order.pickedUpAt)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">
                  {formatCurrency(order.totalAmount)}
                </span>

                <Link
                  href={`/cashier/receipt/${order._id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:border-white/20"
                >
                  <ReceiptText className="h-4 w-4" />
                  Receipt
                </Link>
              </div>
            </div>
          ))}

          {collectedOrders.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500">
              No takeaway orders have been collected yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}