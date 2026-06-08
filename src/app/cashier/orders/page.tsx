import { Banknote, Clock, CreditCard, ReceiptText } from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";

import CashierPaymentManager from "@/components/cashier/CashierPaymentManager";

async function getCashierPaymentData() {
  await connectDB();

  const [unpaidOrders, payments] = await Promise.all([
    Order.find({
      paymentStatus: {
        $in: ["UNPAID", "PENDING", "PARTIALLY_PAID"],
      },
      status: {
        $ne: "CANCELLED",
      },
    })
      .sort({ createdAt: -1 })
      .populate("table")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean(),

    Payment.find()
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(100)
      .populate({
        path: "order",
        populate: [{ path: "table" }],
      })
      .lean(),
  ]);

  return {
    unpaidOrders: JSON.parse(JSON.stringify(unpaidOrders)),
    payments: JSON.parse(JSON.stringify(payments)),
  };
}

function formatCurrency(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US")}`;
}

export default async function CashierOrdersPage() {
  const { unpaidOrders, payments } = await getCashierPaymentData();

  const totalUnpaidAmount = unpaidOrders.reduce(
    (sum: number, order: any) => sum + Number(order.totalAmount || 0),
    0
  );

  const today = new Date();

  const todayPayments = payments.filter((payment: any) => {
    const paidAt = new Date(payment.paidAt || payment.createdAt);
    return paidAt.toDateString() === today.toDateString();
  });

  const todayCollection = todayPayments.reduce(
    (sum: number, payment: any) => sum + Number(payment.amount || 0),
    0
  );

  const cashPaymentsToday = todayPayments.filter(
    (payment: any) => payment.method === "CASH"
  ).length;

  const cardOrOnlinePaymentsToday = todayPayments.filter(
    (payment: any) => payment.method === "CARD" || payment.method === "ONLINE"
  ).length;

  return (
    <main className="min-h-screen bg-[#0B0F14] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
          <p className="text-sm font-medium text-emerald-300">
            Cashier Workspace
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Payments and billing
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Settle unpaid customer orders, record payment methods and review
            recent payment history from the cashier workspace.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <ReceiptText size={21} />
            </div>

            <p className="text-sm text-neutral-500">Unpaid Orders</p>
            <h3 className="mt-2 text-3xl font-semibold text-amber-300">
              {unpaidOrders.length}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
              <Clock size={21} />
            </div>

            <p className="text-sm text-neutral-500">Amount Due</p>
            <h3 className="mt-2 text-3xl font-semibold text-red-300">
              {formatCurrency(totalUnpaidAmount)}
            </h3>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              <Banknote size={21} />
            </div>

            <p className="text-sm text-neutral-500">Today Collection</p>
            <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
              {formatCurrency(todayCollection)}
            </h3>

            <p className="mt-2 text-xs text-neutral-500">
              Cash payments: {cashPaymentsToday}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
              <CreditCard size={21} />
            </div>

            <p className="text-sm text-neutral-500">Card / Online</p>
            <h3 className="mt-2 text-3xl font-semibold text-sky-300">
              {cardOrOnlinePaymentsToday}
            </h3>

            <p className="mt-2 text-xs text-neutral-500">
              Payments settled today
            </p>
          </div>
        </section>

        <CashierPaymentManager
          unpaidOrders={unpaidOrders}
          payments={payments}
        />
      </div>
    </main>
  );
}