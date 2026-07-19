import Link from "next/link";
import mongoose from "mongoose";

import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import MockPaymentButton from "@/components/public/MockPaymentButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

function formatCurrency(amount: number) {
  return `Rs. ${Number(
    amount || 0
  ).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getShortOrderId(orderId: string) {
  return orderId
    .slice(-6)
    .toUpperCase();
}

function getCustomerMenuUrl(order: any) {
  if (
    order.orderType === "TAKE_AWAY"
  ) {
    return "/takeaway";
  }

  if (order.table?.qrCode) {
    return `/table/${encodeURIComponent(
      order.table.qrCode
    )}`;
  }

  return "/";
}

async function getOrder(orderId: string) {
  await connectDB();

  if (
    !mongoose.Types.ObjectId.isValid(orderId)
  ) {
    return null;
  }

  const order = await Order.findById(orderId)
    .populate("table")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")
    .lean();

  return order
    ? JSON.parse(JSON.stringify(order))
    : null;
}

export default async function MockPaymentPage({
  params,
}: RouteParams) {
  const { orderId } = await params;

  const order = await getOrder(orderId);

  if (!order) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-5 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-8 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-300" />

            <h1 className="mt-4 text-2xl font-bold">
              Order not found
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              The payment link is invalid or
              the order no longer exists.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const customerMenuUrl =
    getCustomerMenuUrl(order);

  const isPaid =
    order.paymentStatus === "PAID";

  const isCancelled =
    order.status === "CANCELLED";

  const isPayNow =
    order.paymentType === "PAY_NOW";

  const canPay =
    isPayNow &&
    !isPaid &&
    !isCancelled;

  const itemCount =
    (order.items || []).reduce(
      (total: number, item: any) =>
        total +
        Number(item.quantity || 0),
      0
    ) +
    (order.comboItems || []).reduce(
      (total: number, combo: any) =>
        total +
        Number(combo.quantity || 0),
      0
    );

  return (
    <main className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href={customerMenuUrl}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />

          {order.orderType ===
          "TAKE_AWAY"
            ? "Back to Takeaway Menu"
            : "Back to Table Menu"}
        </Link>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/30">
          <header className="border-b border-white/10 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 px-6 py-8 text-center sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <CreditCard className="h-7 w-7" />
            </div>

            <p className="mt-5 text-sm font-semibold text-emerald-400">
              Mock Online Payment
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Complete Your Payment
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-400">
              This is a simulated online
              payment screen created for
              project testing. No real bank
              transaction will be processed.
            </p>
          </header>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Order
                </p>

                <p className="mt-2 font-bold">
                  #
                  {getShortOrderId(
                    order._id
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Order Type
                </p>

                <p className="mt-2 font-bold">
                  {order.orderType ===
                  "TAKE_AWAY"
                    ? "Takeaway"
                    : order.table?.name ||
                      "Dine-in"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Items
                </p>

                <p className="mt-2 font-bold">
                  {itemCount}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="font-semibold text-white">
                Order Summary
              </h2>

              <div className="mt-4 space-y-3">
                {order.items?.map(
                  (item: any) => (
                    <div
                      key={item._id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-neutral-400">
                        {item.menuItem
                          ?.name ||
                          "Menu item"}{" "}
                        × {item.quantity}
                      </span>

                      <span className="font-medium text-white">
                        {formatCurrency(
                          Number(
                            item.price || 0
                          ) *
                            Number(
                              item.quantity ||
                                0
                            )
                        )}
                      </span>
                    </div>
                  )
                )}

                {order.comboItems?.map(
                  (combo: any) => (
                    <div
                      key={combo._id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-amber-200">
                        {combo.comboOffer
                          ?.name ||
                          "Combo offer"}{" "}
                        × {combo.quantity}
                      </span>

                      <span className="font-medium text-white">
                        {formatCurrency(
                          Number(
                            combo.price || 0
                          ) *
                            Number(
                              combo.quantity ||
                                0
                            )
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
                <span className="font-semibold text-neutral-300">
                  Total Amount
                </span>

                <span className="text-2xl font-bold text-emerald-300">
                  {formatCurrency(
                    order.totalAmount
                  )}
                </span>
              </div>
            </div>

            {isPaid && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />

                  <div>
                    <h2 className="font-semibold text-emerald-100">
                      This order is already
                      paid
                    </h2>

                    <p className="mt-1 text-sm text-emerald-200/70">
                      The payment was
                      completed successfully.
                    </p>

                    <Link
                      href={`/order/${order._id}/receipt`}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-neutral-200"
                    >
                      <ReceiptText className="h-4 w-4" />
                      View Receipt
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {isCancelled && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-300" />

                  <div>
                    <h2 className="font-semibold text-red-100">
                      Payment unavailable
                    </h2>

                    <p className="mt-1 text-sm text-red-200/70">
                      A cancelled order
                      cannot be paid.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isPayNow &&
              !isPaid &&
              !isCancelled && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200">
                  This order was created as
                  Pay Later. Please complete
                  payment through the cashier.
                </div>
              )}

            {canPay && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />

                  <p className="text-sm leading-6 text-neutral-400">
                    The payment amount is
                    loaded from the saved
                    order. The server verifies
                    the order before marking
                    it as paid.
                  </p>
                </div>

                <MockPaymentButton
                  orderId={order._id}
                  amount={order.totalAmount}
                />
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-neutral-600">
              {order.orderType ===
              "TAKE_AWAY" ? (
                <ShoppingBag className="h-4 w-4" />
              ) : (
                <UtensilsCrossed className="h-4 w-4" />
              )}

              Saffron Table Restaurant
              Ordering System
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}