import Link from "next/link";
import { CheckCircle2, ReceiptText } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import "@/models/Table";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

async function getOrder(orderId: string) {
  await connectDB();

  const order = await Order.findById(orderId).populate("table").lean();

  return JSON.parse(JSON.stringify(order));
}

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

export default async function PaymentSuccessPage({ params }: RouteParams) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F4F5] px-4 text-black">
      <section className="w-full max-w-md rounded-[32px] border border-neutral-200 bg-white p-8 text-center shadow-xl shadow-black/5">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={34} />
        </div>

        <p className="text-sm font-semibold text-emerald-600">
          Payment Successful
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Order confirmed
        </h1>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Your order has been placed successfully and payment has been marked as
          paid.
        </p>

        {order && (
          <div className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 text-left">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-neutral-500">Order</p>
                <p className="font-bold">
                  #{order._id.slice(-6).toUpperCase()}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-neutral-500">Amount</p>
                <p className="font-bold text-emerald-600">
                  {formatCurrency(order.totalAmount)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-neutral-500">
              {order.table?.name || "Table order"} • {order.paymentStatus}
            </p>
          </div>
        )}

        <Link
          href={`/cashier/receipt/${orderId}`}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          <ReceiptText size={18} />
          View Receipt
        </Link>
      </section>
    </main>
  );
}