import Link from "next/link";
import mongoose from "mongoose";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ReceiptText,
  ShoppingBag,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import Payment from "@/models/Payment";

import "@/models/Table";

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

function formatDateTime(
  value?: string | Date | null
) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

async function getPaymentData(
  orderId: string
) {
  await connectDB();

  if (
    !mongoose.Types.ObjectId.isValid(orderId)
  ) {
    return {
      order: null,
      payment: null,
    };
  }

  const [
    orderDocument,
    paymentDocument,
  ] = await Promise.all([
    Order.findById(orderId)
      .populate("table")
      .lean(),

    Payment.findOne({
      order: orderId,
      status: "PAID",
    })
      .sort({
        paidAt: -1,
        createdAt: -1,
      })
      .lean(),
  ]);

  return {
    order: orderDocument
      ? JSON.parse(
          JSON.stringify(orderDocument)
        )
      : null,

    payment: paymentDocument
      ? JSON.parse(
          JSON.stringify(paymentDocument)
        )
      : null,
  };
}

export default async function PaymentSuccessPage({
  params,
}: RouteParams) {
  const { orderId } = await params;

  const {
    order,
    payment,
  } = await getPaymentData(orderId);

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
          </div>
        </div>
      </main>
    );
  }

  const menuUrl =
    getCustomerMenuUrl(order);

  const paymentCompleted =
    order.paymentStatus === "PAID" &&
    Boolean(payment);

  if (!paymentCompleted) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-5 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href={menuUrl}
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to menu
          </Link>

          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-8 text-center">
            <Clock3 className="mx-auto h-12 w-12 text-amber-300" />

            <h1 className="mt-4 text-2xl font-bold">
              Payment not completed
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              Complete the mock payment
              before opening the success
              page.
            </p>

            <Link
              href={`/payment/${order._id}`}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-black"
            >
              Return to Payment
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const pickupNumber =
    order._id
      .slice(-6)
      .toUpperCase();

  return (
    <main className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-white/[0.03] shadow-2xl shadow-black/30">
          <header className="bg-gradient-to-br from-emerald-500/20 to-sky-500/5 px-6 py-10 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-emerald-300">
              Payment Successful
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Order Confirmed
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-300">
              Your mock online payment was
              completed successfully. The
              order has been marked as paid
              and sent to the restaurant
              workflow.
            </p>
          </header>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Order Number
                </p>

                <p className="mt-2 text-xl font-bold">
                  #{pickupNumber}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Amount Paid
                </p>

                <p className="mt-2 text-xl font-bold text-emerald-300">
                  {formatCurrency(
                    payment.amount
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
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

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Paid At
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {formatDateTime(
                    payment.paidAt ||
                      payment.createdAt
                  )}
                </p>
              </div>
            </div>

            {order.orderType ===
              "TAKE_AWAY" && (
              <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-5">
                <ShoppingBag className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />

                <div>
                  <p className="font-semibold text-white">
                    Pickup Number:{" "}
                    {pickupNumber}
                  </p>

                  <p className="mt-1 text-sm text-neutral-400">
                    Keep this number and
                    present it when collecting
                    your takeaway order.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/order/${order._id}/receipt`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400"
              >
                <ReceiptText className="h-5 w-5" />
                View and Print Receipt
              </Link>

              <Link
                href={menuUrl}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20"
              >
                {order.orderType ===
                "TAKE_AWAY" ? (
                  <ShoppingBag className="h-5 w-5" />
                ) : (
                  <UtensilsCrossed className="h-5 w-5" />
                )}

                {order.orderType ===
                "TAKE_AWAY"
                  ? "Back to Takeaway Menu"
                  : "Back to Table Menu"}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}