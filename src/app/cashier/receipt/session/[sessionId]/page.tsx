import Link from "next/link";
import mongoose from "mongoose";

import {
  ArrowLeft,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import DiningSession from "@/models/DiningSession";
import Order from "@/models/Order";
import Payment from "@/models/Payment";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import PrintReceiptButton from "@/components/cashier/PrintReceiptButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =========================
   Types
========================= */

type RouteParams = {
  params: Promise<{
    sessionId: string;
  }>;
};

type ReceiptData = {
  diningSession: any | null;
  payment: any | null;
  orders: any[];
};

/* =========================
   Formatting helpers
========================= */

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString(
    "en-LK",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
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

function getShortId(value: string) {
  return value.slice(-6).toUpperCase();
}

/* =========================
   Data loading
========================= */

async function getCombinedReceiptData(
  sessionId: string
): Promise<ReceiptData> {
  await connectDB();

  if (
    !mongoose.Types.ObjectId.isValid(sessionId)
  ) {
    return {
      diningSession: null,
      payment: null,
      orders: [],
    };
  }

  /*
   * Load the dining session and its table.
   */
  const diningSessionDocument =
    await DiningSession.findById(sessionId)
      .populate("table")
      .lean();

  if (!diningSessionDocument) {
    return {
      diningSession: null,
      payment: null,
      orders: [],
    };
  }

  /*
   * Load the latest successful payment made
   * for this combined dining-session bill.
   */
  const paymentDocument =
    await Payment.findOne({
      diningSession: sessionId,
      status: "PAID",
    })
      .sort({
        paidAt: -1,
        createdAt: -1,
      })
      .lean();

  let orderDocuments: any[] = [];

  if (paymentDocument) {
    const paymentData =
      paymentDocument as any;

    /*
     * A new combined payment stores the exact
     * included orders inside payment.orders.
     */
    const paymentOrderIds = Array.isArray(
      paymentData.orders
    )
      ? paymentData.orders
          .map((orderReference: any) => {
            if (!orderReference) {
              return null;
            }

            if (
              typeof orderReference === "object" &&
              orderReference._id
            ) {
              return orderReference._id;
            }

            return orderReference;
          })
          .filter(Boolean)
      : [];

    if (paymentOrderIds.length > 0) {
      /*
       * Load the exact orders included in
       * the combined payment.
       *
       * The diningSession condition prevents
       * an unrelated order from being displayed.
       */
      orderDocuments = await Order.find({
        _id: {
          $in: paymentOrderIds,
        },

        diningSession: sessionId,
      })
        .sort({
          createdAt: 1,
        })
        .populate("table")
        .populate("items.menuItem")
        .populate("comboItems.comboOffer")
        .lean();
    } else {
      /*
       * Fallback for older combined-payment
       * records without a payment.orders array.
       */
      orderDocuments = await Order.find({
        diningSession: sessionId,
        orderType: "DINE_IN",

        status: {
          $ne: "CANCELLED",
        },

        paymentStatus: "PAID",
      })
        .sort({
          createdAt: 1,
        })
        .populate("table")
        .populate("items.menuItem")
        .populate("comboItems.comboOffer")
        .lean();
    }
  }

  return {
    diningSession: JSON.parse(
      JSON.stringify(diningSessionDocument)
    ),

    payment: paymentDocument
      ? JSON.parse(
          JSON.stringify(paymentDocument)
        )
      : null,

    orders: JSON.parse(
      JSON.stringify(orderDocuments)
    ),
  };
}

/* =========================
   Page
========================= */

export default async function CombinedReceiptPage({
  params,
}: RouteParams) {
  const { sessionId } = await params;

  const {
    diningSession,
    payment,
    orders,
  } = await getCombinedReceiptData(sessionId);

  /* =========================
     Invalid session
  ========================= */

  if (!diningSession) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/cashier/orders"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to cashier
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-8 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-red-300" />

            <h1 className="mt-4 text-2xl font-bold">
              Combined receipt not found
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              The dining session does not exist,
              or the receipt link is invalid.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     Session not paid
  ========================= */

  if (!payment || orders.length === 0) {
    return (
      <main className="min-h-screen bg-[#0b0f14] px-5 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/cashier/orders"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to cashier
          </Link>

          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-8 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-amber-300" />

            <h1 className="mt-4 text-2xl font-bold">
              Payment receipt is not available
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              Settle the combined table bill
              before opening this receipt.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* =========================
     Receipt calculations
  ========================= */

  const tableName =
    diningSession.table?.name ||
    "Dining Table";

  const combinedSubtotal = orders.reduce(
    (total: number, order: any) =>
      total +
      Number(order.totalAmount || 0),
    0
  );

  const paidAmount = Number(
    payment.amount || combinedSubtotal
  );

  const customerNames: string[] =
    Array.from(
      new Set<string>(
        orders
          .map((order: any) =>
            String(
              order.customerName || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  const customerPhones: string[] =
    Array.from(
      new Set<string>(
        orders
          .map((order: any) =>
            String(
              order.customerPhone || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  const totalNormalItems = orders.reduce(
    (total: number, order: any) =>
      total +
      (Array.isArray(order.items)
        ? order.items.reduce(
            (
              itemTotal: number,
              item: any
            ) =>
              itemTotal +
              Number(item.quantity || 0),
            0
          )
        : 0),
    0
  );

  const totalComboItems = orders.reduce(
    (total: number, order: any) =>
      total +
      (Array.isArray(order.comboItems)
        ? order.comboItems.reduce(
            (
              comboTotal: number,
              combo: any
            ) =>
              comboTotal +
              Number(combo.quantity || 0),
            0
          )
        : 0),
    0
  );

  /* =========================
     Receipt UI
  ========================= */

  return (
    <main className="min-h-screen bg-[#0b0f14] px-4 py-8 text-white sm:px-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        {/* Screen-only controls */}
        <div className="mb-6 flex flex-col gap-4 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/cashier/orders"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to cashier
          </Link>

          <PrintReceiptButton />
        </div>

        {/* Printable receipt */}
        <article className="overflow-hidden rounded-2xl border border-white/10 bg-white text-black shadow-2xl shadow-black/30 print:rounded-none print:border-0 print:shadow-none">
          {/* Header */}
          <header className="border-b border-neutral-200 px-6 py-7 text-center sm:px-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white print:border print:border-black print:bg-white print:text-black">
              <UtensilsCrossed className="h-6 w-6" />
            </div>

            <h1 className="mt-4 text-3xl font-bold">
              Saffron Table
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              Restaurant Ordering and Management
              System
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold">
              <ReceiptText className="h-4 w-4" />
              Combined Table Receipt
            </div>
          </header>

          {/* Session details */}
          <section className="grid gap-5 border-b border-neutral-200 px-6 py-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Table
              </p>

              <p className="mt-1 font-bold">
                {tableName}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Session Number
              </p>

              <p className="mt-1 font-bold">
                #
                {getShortId(
                  diningSession._id
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Number of Orders
              </p>

              <p className="mt-1 font-bold">
                {orders.length}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Payment
              </p>

              <p className="mt-1 font-bold">
                {payment.method} •{" "}
                {payment.status}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Session Opened
              </p>

              <p className="mt-1 text-sm font-medium">
                {formatDateTime(
                  diningSession.openedAt ||
                    diningSession.createdAt
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Session Closed
              </p>

              <p className="mt-1 text-sm font-medium">
                {formatDateTime(
                  diningSession.closedAt
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Paid At
              </p>

              <p className="mt-1 text-sm font-medium">
                {formatDateTime(
                  payment.paidAt ||
                    payment.createdAt
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Payment Reference
              </p>

              <p className="mt-1 text-sm font-medium">
                #
                {getShortId(
                  payment._id
                )}
              </p>
            </div>

            {customerNames.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Customer
                </p>

                <p className="mt-1 text-sm font-medium">
                  {customerNames.join(", ")}
                </p>
              </div>
            )}

            {customerPhones.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Phone
                </p>

                <p className="mt-1 text-sm font-medium">
                  {customerPhones.join(", ")}
                </p>
              </div>
            )}
          </section>

          {/* Order summary */}
          <section className="grid gap-4 border-b border-neutral-200 bg-neutral-50 px-6 py-5 sm:grid-cols-3 sm:px-10">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Orders
              </p>

              <p className="mt-2 text-2xl font-bold">
                {orders.length}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Normal Item Quantity
              </p>

              <p className="mt-2 text-2xl font-bold">
                {totalNormalItems}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Combo Quantity
              </p>

              <p className="mt-2 text-2xl font-bold">
                {totalComboItems}
              </p>
            </div>
          </section>

          {/* Orders and items */}
          <section className="space-y-7 px-6 py-7 sm:px-10">
            <div>
              <h2 className="text-xl font-bold">
                Ordered Items
              </h2>

              <p className="mt-1 text-sm text-neutral-500">
                All orders placed during this
                dining session
              </p>
            </div>

            {orders.map(
              (
                order: any,
                orderIndex: number
              ) => {
                const orderTotal = Number(
                  order.totalAmount || 0
                );

                const hasNormalItems =
                  Array.isArray(order.items) &&
                  order.items.length > 0;

                const hasComboItems =
                  Array.isArray(
                    order.comboItems
                  ) &&
                  order.comboItems.length > 0;

                return (
                  <div
                    key={order._id}
                    className="break-inside-avoid overflow-hidden rounded-xl border border-neutral-200"
                  >
                    {/* Individual order heading */}
                    <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Order{" "}
                          {orderIndex + 1}
                        </p>

                        <h3 className="mt-1 font-bold">
                          Order #
                          {getShortId(
                            order._id
                          )}
                        </h3>

                        <p className="mt-1 text-xs text-neutral-500">
                          {formatDateTime(
                            order.createdAt
                          )}
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          Status:{" "}
                          {String(
                            order.status || ""
                          ).replaceAll(
                            "_",
                            " "
                          )}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xs text-neutral-500">
                          Order Total
                        </p>

                        <p className="mt-1 text-lg font-bold">
                          {formatCurrency(
                            orderTotal
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Item table */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
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
                                  {item
                                    .menuItem
                                    ?.name ||
                                    "Menu item"}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {
                                    item.quantity
                                  }
                                </td>

                                <td className="px-4 py-3 text-right">
                                  {formatCurrency(
                                    item.price
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(
                                    Number(
                                      item.price ||
                                        0
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
                                    {combo
                                      .comboOffer
                                      ?.name ||
                                      "Combo offer"}
                                  </p>

                                  {Array.isArray(
                                    combo.comboItemsSnapshot
                                  ) &&
                                    combo
                                      .comboItemsSnapshot
                                      .length >
                                      0 && (
                                      <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
                                        {combo.comboItemsSnapshot.map(
                                          (
                                            snapshot: any,
                                            snapshotIndex: number
                                          ) => (
                                            <p
                                              key={`${combo._id}-${snapshotIndex}`}
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
                                      </div>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                  {
                                    combo.quantity
                                  }
                                </td>

                                <td className="px-4 py-3 text-right">
                                  {formatCurrency(
                                    combo.price
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(
                                    Number(
                                      combo.price ||
                                        0
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

                          {!hasNormalItems &&
                            !hasComboItems && (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-4 py-6 text-center text-neutral-500"
                                >
                                  No ordered
                                  items found.
                                </td>
                              </tr>
                            )}
                        </tbody>

                        <tfoot>
                          <tr className="bg-neutral-50 font-semibold">
                            <td
                              colSpan={3}
                              className="px-4 py-3 text-right"
                            >
                              Order Total
                            </td>

                            <td className="px-4 py-3 text-right">
                              {formatCurrency(
                                orderTotal
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              }
            )}
          </section>

          {/* Final totals */}
          <section className="border-t border-neutral-200 bg-neutral-50 px-6 py-7 sm:px-10">
            <div className="ml-auto max-w-md space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-neutral-600">
                  Number of orders
                </span>

                <span className="font-semibold">
                  {orders.length}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-neutral-600">
                  Combined subtotal
                </span>

                <span className="font-semibold">
                  {formatCurrency(
                    combinedSubtotal
                  )}
                </span>
              </div>

              {paidAmount !==
                combinedSubtotal && (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-neutral-600">
                    Recorded payment
                  </span>

                  <span className="font-semibold">
                    {formatCurrency(
                      paidAmount
                    )}
                  </span>
                </div>
              )}

              <div className="border-t border-neutral-300 pt-4">
                <div className="flex items-center justify-between gap-4">
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

              <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm">
                <p>
                  Paid by{" "}
                  <strong>
                    {payment.method}
                  </strong>{" "}
                  on{" "}
                  <strong>
                    {formatDateTime(
                      payment.paidAt ||
                        payment.createdAt
                    )}
                  </strong>
                </p>

                {payment.note && (
                  <p className="mt-2 text-neutral-600">
                    Note: {payment.note}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-neutral-200 px-6 py-6 text-center sm:px-10">
            <p className="font-semibold">
              Thank you for dining with us.
            </p>

            <p className="mt-2 text-xs text-neutral-500">
              This receipt was generated by the
              Saffron Table Restaurant Ordering
              and Management System.
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
}