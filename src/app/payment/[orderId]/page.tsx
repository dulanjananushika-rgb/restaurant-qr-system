import Link from "next/link";
import { ArrowLeft, CreditCard, ReceiptText, ShieldCheck } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import MockPaymentButton from "@/components/public/MockPaymentButton";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

async function getOrder(orderId: string) {
  await connectDB();

  const order = await Order.findById(orderId)
    .populate("table")
    .populate("items.menuItem")
    .populate("comboItems.comboOffer")
    .lean();

  return JSON.parse(JSON.stringify(order));
}

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

export default async function MockPaymentPage({ params }: RouteParams) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F5] px-4 text-black">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <ReceiptText className="mx-auto mb-4 text-neutral-400" size={42} />
          <h1 className="text-xl font-bold">Order not found</h1>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
          >
            Go back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F4F5] px-4 py-8 text-black">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/menu/${order.table?._id || ""}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to menu
        </Link>

        <section className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-xl shadow-black/5">
          <div className="border-b border-neutral-200 px-8 py-7">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
              <CreditCard size={28} />
            </div>

            <p className="text-sm font-semibold text-emerald-600">
              Mock Online Payment
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Complete your payment
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              This is a simulated payment screen for project testing. No real
              payment will be processed.
            </p>
          </div>

          <div className="space-y-5 px-8 py-7">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Order
              </p>

              <div className="mt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold">
                    #{order._id.slice(-6).toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {order.table?.name || "Table order"}
                  </p>
                </div>

                <p className="text-2xl font-black text-emerald-600">
                  {formatCurrency(order.totalAmount)}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <p className="text-sm font-bold">Payment details</p>
              </div>

              <div className="grid gap-3">
                <input
                  readOnly
                  value="4242 4242 4242 4242"
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    readOnly
                    value="12/30"
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none"
                  />

                  <input
                    readOnly
                    value="123"
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            {order.paymentStatus === "PAID" ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <p className="font-bold text-emerald-700">
                  This order is already paid.
                </p>

                <Link
                  href={`/cashier/receipt/${order._id}`}
                  className="mt-4 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white"
                >
                  View Receipt
                </Link>
              </div>
            ) : (
              <MockPaymentButton
                orderId={order._id}
                amount={order.totalAmount}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}