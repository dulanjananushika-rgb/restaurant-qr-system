import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import PrintReceiptButton from "@/components/cashier/PrintReceiptButton";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

async function getReceiptData(orderId: string) {
  await connectDB();

  const order = await Order.findById(orderId)
    .populate("table")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")
    .lean();

  const payment = await Payment.findOne({
    order: orderId,
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();

  return {
    order: JSON.parse(JSON.stringify(order)),
    payment: JSON.parse(JSON.stringify(payment)),
  };
}

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

function formatDateTime(date?: string | null) {
  if (!date) return "N/A";
  return new Date(date).toLocaleString();
}

export default async function CashierReceiptPage({ params }: RouteParams) {
  const { orderId } = await params;
  const { order, payment } = await getReceiptData(orderId);

  if (!order) {
    return (
      <main className="min-h-screen bg-[#F4F4F5] px-4 py-8 text-black">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/cashier/orders"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-black"
          >
            <ArrowLeft size={16} />
            Back to cashier
          </Link>

          <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
            <ReceiptText className="mx-auto mb-3 text-neutral-400" size={40} />
            <p className="text-sm text-neutral-500">Receipt not found.</p>
          </div>
        </div>
      </main>
    );
  }

  const normalItemsTotal =
    order.items?.reduce(
      (sum: number, item: any) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    ) || 0;

  const comboItemsTotal =
    order.comboItems?.reduce(
      (sum: number, combo: any) =>
        sum + Number(combo.price || 0) * Number(combo.quantity || 0),
      0
    ) || 0;

  const totalAmount = Number(
    order.totalAmount || normalItemsTotal + comboItemsTotal
  );

  return (
    <main className="min-h-screen bg-[#F4F4F5] px-4 py-8 text-black print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link
            href="/cashier/orders"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-black"
          >
            <ArrowLeft size={16} />
            Back to cashier
          </Link>

          <PrintReceiptButton />
        </div>

        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-xl shadow-black/5 print:rounded-none print:border-0 print:shadow-none">
          <div className="border-b border-neutral-200 px-8 py-7 text-center">
            <h1 className="text-3xl font-black tracking-tight">
              Saffron Table
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Restaurant Order Receipt
            </p>
            <p className="mt-3 text-xs text-neutral-400">
              Thank you for dining with us
            </p>
          </div>

          <div className="grid gap-4 border-b border-neutral-200 px-8 py-6 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Order No
              </p>
              <p className="mt-1 font-bold">
                #{order._id.slice(-6).toUpperCase()}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Table
              </p>
              <p className="mt-1 font-bold">{order.table?.name || "No table"}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Date & Time
              </p>
              <p className="mt-1 font-medium">
                {formatDateTime(order.createdAt)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Payment
              </p>
              <p className="mt-1 font-medium">
                {payment?.method || order.paymentType} • {order.paymentStatus}
              </p>
            </div>

            {(order.customerName || order.customerPhone) && (
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Customer
                </p>
                <p className="mt-1 font-medium">
                  {order.customerName || "N/A"}{" "}
                  {order.customerPhone ? `• ${order.customerPhone}` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="px-8 py-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              Ordered Items
            </h2>

            <div className="overflow-hidden rounded-2xl border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-100 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200">
                  {order.items?.map((item: any) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3 font-medium">
                        {item.menuItem?.name || "Menu item"}
                      </td>

                      <td className="px-4 py-3 text-center text-neutral-600">
                        {item.quantity}
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-600">
                        {formatCurrency(item.price)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}

                  {order.comboItems?.map((combo: any) => (
                    <tr key={combo._id}>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {combo.comboOffer?.name || "Combo offer"}
                        </p>

                        <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
                          {combo.comboItemsSnapshot?.map(
                            (snapshot: any, index: number) => (
                              <p key={`${combo._id}-${index}`}>
                                • {snapshot.name} × {snapshot.quantity}
                              </p>
                            )
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center text-neutral-600">
                        {combo.quantity}
                      </td>

                      <td className="px-4 py-3 text-right text-neutral-600">
                        {formatCurrency(combo.price)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(combo.price * combo.quantity)}
                      </td>
                    </tr>
                  ))}

                  {(!order.items || order.items.length === 0) &&
                    (!order.comboItems || order.comboItems.length === 0) && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-neutral-500"
                        >
                          No ordered items found.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>

                <div className="mt-4 border-t border-neutral-200 pt-4">
                  <div className="flex justify-between text-xl font-black">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                {payment && (
                  <div className="mt-4 rounded-xl bg-white px-3 py-2 text-xs text-neutral-500">
                    Paid by {payment.method} on {formatDateTime(payment.paidAt)}
                  </div>
                )}

                {payment?.note && (
                  <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-neutral-500">
                    Note: {payment.note}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-200 px-8 py-5 text-center">
            <p className="text-xs text-neutral-500">
              This receipt was generated by Saffron Table Restaurant Ordering
              System.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}