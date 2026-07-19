import Link from "next/link";
import mongoose from "mongoose";

import {
  ArrowLeft,
  CheckCircle2,
  ReceiptText,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import Payment from "@/models/Payment";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import PrintReceiptButton from "@/components/cashier/PrintReceiptButton";

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

async function getReceiptData(
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
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean(),

    Payment.findOne({
      status: "PAID",

      $or: [
        {
          order: orderId,
        },
        {
          orders: orderId,
        },
      ],
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

export default async function PublicReceiptPage({
  params,
}: RouteParams) {
  const { orderId } = await params;

  const {
    order,
    payment,
  } = await getReceiptData(orderId);

  if (!order) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-8 text-center">
            <ReceiptText className="mx-auto h-11 w-11 text-red-300" />

            <h1 className="mt-4 text-2xl font-bold">
              Receipt not found
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              The order does not exist or
              the receipt link is invalid.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const backUrl =
    getCustomerMenuUrl(order);

  if (
    order.paymentStatus !== "PAID"
  ) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href={backUrl}
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to menu
          </Link>

          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-8 text-center">
            <ReceiptText className="mx-auto h-11 w-11 text-amber-300" />

            <h1 className="mt-4 text-2xl font-bold">
              Receipt unavailable
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              The receipt will become
              available after payment is
              completed.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const totalAmount = Number(
    order.totalAmount || 0
  );

  const paidAmount = Number(
    payment?.amount || totalAmount
  );

  return (
    <main className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white sm:px-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={backUrl}
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />

            {order.orderType ===
            "TAKE_AWAY"
              ? "Back to Takeaway Menu"
              : "Back to Table Menu"}
          </Link>

          <PrintReceiptButton />
        </div>

        <article className="overflow-hidden rounded-2xl border border-white/10 bg-white text-black shadow-2xl shadow-black/30 print:rounded-none print:border-0 print:shadow-none">
          <header className="border-b border-neutral-200 px-6 py-8 text-center sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white print:border print:border-black print:bg-white print:text-black">
              <UtensilsCrossed className="h-7 w-7" />
            </div>

            <h1 className="mt-4 text-3xl font-bold">
              Saffron Table
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Restaurant Order Receipt
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Payment Completed
            </div>
          </header>

          <section className="grid gap-5 border-b border-neutral-200 px-6 py-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Order Number
              </p>

              <p className="mt-1 font-bold">
                #
                {order._id
                  .slice(-6)
                  .toUpperCase()}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Order Type
              </p>

              <p className="mt-1 font-bold">
                {order.orderType ===
                "TAKE_AWAY"
                  ? "Takeaway"
                  : order.table?.name ||
                    "Dine-in"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Payment
              </p>

              <p className="mt-1 font-bold">
                {payment?.method ||
                  "ONLINE"}{" "}
                • PAID
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Paid At
              </p>

              <p className="mt-1 text-sm font-medium">
                {formatDateTime(
                  payment?.paidAt ||
                    payment?.createdAt
                )}
              </p>
            </div>

            {order.customerName && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Customer
                </p>

                <p className="mt-1 text-sm font-medium">
                  {order.customerName}
                </p>
              </div>
            )}
          </section>

          <section className="px-6 py-7 sm:px-10">
            <div className="mb-5">
              <h2 className="text-xl font-bold">
                Ordered Items
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                Items included in this order
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-3">
                      Item
                    </th>

                    <th className="px-4 py-3 text-center">
                      Quantity
                    </th>

                    <th className="px-4 py-3 text-right">
                      Unit Price
                    </th>

                    <th className="px-4 py-3 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {order.items?.map(
                    (item: any) => (
                      <tr
                        key={item._id}
                        className="border-b border-neutral-100"
                      >
                        <td className="px-4 py-3 font-medium">
                          {item.menuItem
                            ?.name ||
                            "Menu item"}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {item.quantity}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatCurrency(
                            item.price
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(
                            Number(
                              item.price || 0
                            ) *
                              Number(
                                item.quantity ||
                                  0
                              )
                          )}
                        </td>
                      </tr>
                    )
                  )}

                  {order.comboItems?.map(
                    (combo: any) => (
                      <tr
                        key={combo._id}
                        className="border-b border-neutral-100"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {combo.comboOffer
                              ?.name ||
                              "Combo offer"}
                          </p>

                          {combo
                            .comboItemsSnapshot
                            ?.map(
                              (
                                snapshot: any,
                                index: number
                              ) => (
                                <p
                                  key={`${combo._id}-${index}`}
                                  className="mt-1 text-xs text-neutral-500"
                                >
                                  •{" "}
                                  {
                                    snapshot.name
                                  }{" "}
                                  ×{" "}
                                  {
                                    snapshot.quantity
                                  }
                                </p>
                              )
                            )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {combo.quantity}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {formatCurrency(
                            combo.price
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(
                            Number(
                              combo.price || 0
                            ) *
                              Number(
                                combo.quantity ||
                                  0
                              )
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-t border-neutral-200 bg-neutral-50 px-6 py-7 sm:px-10">
            <div className="ml-auto max-w-md space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">
                  Order Total
                </span>

                <span className="font-semibold">
                  {formatCurrency(
                    totalAmount
                  )}
                </span>
              </div>

              <div className="border-t border-neutral-300 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    Total Paid
                  </span>

                  <span className="text-2xl font-bold">
                    {formatCurrency(
                      paidAmount
                    )}
                  </span>
                </div>
              </div>

              {payment?.note && (
                <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
                  Note: {payment.note}
                </div>
              )}
            </div>
          </section>

          <footer className="border-t border-neutral-200 px-6 py-6 text-center sm:px-10">
            <p className="font-semibold">
              Thank you for your order.
            </p>

            <p className="mt-2 text-xs text-neutral-500">
              This receipt was generated by
              the Saffron Table Restaurant
              Ordering System.
            </p>
          </footer>
        </article>

        {order.orderType ===
          "TAKE_AWAY" && (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-4 text-sm text-sky-200 print:hidden">
            <ShoppingBag className="h-5 w-5" />

            Pickup Number:{" "}
            <strong>
              {order._id
                .slice(-6)
                .toUpperCase()}
            </strong>
          </div>
        )}
      </div>
    </main>
  );
}