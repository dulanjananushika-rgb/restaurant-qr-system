import Link from "next/link";

import {
  Banknote,
  CreditCard,
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
import "@/models/DiningSession";

import CashierPaymentManager from "@/components/cashier/CashierPaymentManager";
import LogoutButton from "@/components/auth/LogoutButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =========================
   Types
========================= */

type SessionBill = {
  diningSessionId: string;

  table?: {
    _id: string;
    name: string;
  } | null;

  orders: any[];

  totalAmount: number;
  allDelivered: boolean;
  createdAt: string;
};

/* =========================
   Helper functions
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

function isToday(
  value?: string | Date | null
) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/*
 * Convert separate unpaid orders into:
 *
 * 1. Combined dining-session bills
 * 2. Individual takeaway / legacy bills
 */
function buildBills(unpaidOrders: any[]) {
  const sessionMap =
    new Map<string, SessionBill>();

  const singleOrders: any[] = [];

  for (const order of unpaidOrders) {
    const diningSessionId =
      order.diningSession?._id ||
      order.diningSession ||
      null;

    const belongsToDiningSession =
      order.orderType === "DINE_IN" &&
      Boolean(diningSessionId);

    if (!belongsToDiningSession) {
      /*
       * Takeaway orders and older dine-in
       * orders without a dining session.
       */
      singleOrders.push(order);
      continue;
    }

    const sessionKey =
      String(diningSessionId);

    const existingBill =
      sessionMap.get(sessionKey);

    if (existingBill) {
      existingBill.orders.push(order);

      existingBill.totalAmount +=
        Number(order.totalAmount || 0);

      existingBill.allDelivered =
        existingBill.allDelivered &&
        order.status === "DELIVERED";

      const currentCreatedTime =
        new Date(order.createdAt).getTime();

      const existingCreatedTime =
        new Date(
          existingBill.createdAt
        ).getTime();

      if (
        currentCreatedTime <
        existingCreatedTime
      ) {
        existingBill.createdAt =
          order.createdAt;
      }

      continue;
    }

    sessionMap.set(sessionKey, {
      diningSessionId: sessionKey,

      table: order.table || null,

      orders: [order],

      totalAmount: Number(
        order.totalAmount || 0
      ),

      allDelivered:
        order.status === "DELIVERED",

      createdAt: order.createdAt,
    });
  }

  const sessionBills =
    Array.from(sessionMap.values())
      .map((bill) => ({
        ...bill,

        orders: [...bill.orders].sort(
          (firstOrder, secondOrder) =>
            new Date(
              firstOrder.createdAt
            ).getTime() -
            new Date(
              secondOrder.createdAt
            ).getTime()
        ),
      }))
      .sort(
        (firstBill, secondBill) =>
          new Date(
            secondBill.createdAt
          ).getTime() -
          new Date(
            firstBill.createdAt
          ).getTime()
      );

  singleOrders.sort(
    (firstOrder, secondOrder) =>
      new Date(
        secondOrder.createdAt
      ).getTime() -
      new Date(
        firstOrder.createdAt
      ).getTime()
  );

  return {
    sessionBills,
    singleOrders,
  };
}

/* =========================
   Database data
========================= */

async function getCashierPaymentData() {
  await connectDB();

  const [
    unpaidOrderDocuments,
    paymentDocuments,
  ] = await Promise.all([
    /*
     * Load every order that still requires
     * payment.
     */
    Order.find({
      paymentStatus: {
        $in: [
          "UNPAID",
          "PENDING",
          "PARTIALLY_PAID",
        ],
      },

      status: {
        $ne: "CANCELLED",
      },
    })
      .sort({
        createdAt: -1,
      })
      .populate("table")
      .populate("diningSession")
      .populate("items.menuItem")
      .populate("comboItems.comboOffer")
      .lean(),

    /*
     * Load both individual and combined
     * payment records.
     */
    Payment.find()
      .sort({
        paidAt: -1,
        createdAt: -1,
      })
      .limit(100)
      .populate({
        path: "order",
        populate: {
          path: "table",
        },
      })
      .populate({
        path: "orders",
        populate: {
          path: "table",
        },
      })
      .populate({
        path: "diningSession",
        populate: {
          path: "table",
        },
      })
      .lean(),
  ]);

  /*
   * Convert Mongoose objects into plain
   * serializable objects before sending them
   * to the client component.
   */
  const unpaidOrders = JSON.parse(
    JSON.stringify(unpaidOrderDocuments)
  );

  const payments = JSON.parse(
    JSON.stringify(paymentDocuments)
  );

  const {
    sessionBills,
    singleOrders,
  } = buildBills(unpaidOrders);

  return {
    unpaidOrders,
    sessionBills,
    singleOrders,
    payments,
  };
}

/* =========================
   Page component
========================= */

export default async function CashierOrdersPage() {
  const {
    unpaidOrders,
    sessionBills,
    singleOrders,
    payments,
  } = await getCashierPaymentData();

  const unpaidBillCount =
    sessionBills.length +
    singleOrders.length;

  const totalUnpaidAmount =
    unpaidOrders.reduce(
      (
        total: number,
        order: any
      ) =>
        total +
        Number(order.totalAmount || 0),
      0
    );

  const todayPayments =
    payments.filter(
      (payment: any) =>
        isToday(
          payment.paidAt ||
            payment.createdAt
        )
    );

  const todayCollection =
    todayPayments.reduce(
      (
        total: number,
        payment: any
      ) =>
        total +
        Number(payment.amount || 0),
      0
    );

  const cashPaymentsToday =
    todayPayments.filter(
      (payment: any) =>
        payment.method === "CASH"
    ).length;

  const cardOrOnlinePaymentsToday =
    todayPayments.filter(
      (payment: any) =>
        payment.method === "CARD" ||
        payment.method === "ONLINE"
    ).length;

  const takeawayOrders =
    singleOrders.filter(
      (order: any) =>
        order.orderType ===
        "TAKE_AWAY"
    );

  return (
    <main className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Cashier Workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Payments and Billing
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Settle one combined bill for all
            unpaid orders in the same dining
            session. Takeaway orders are
            handled as individual payments.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/cashier/takeaway"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            <ShoppingBag className="h-4 w-4" />

            Takeaway Orders
          </Link>

          <LogoutButton />
        </div>
      </section>

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <ReceiptText className="h-5 w-5 text-sky-300" />

          <p className="mt-3 text-sm text-neutral-400">
            Unpaid Bills
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {unpaidBillCount}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {unpaidOrders.length} separate
            orders
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <UtensilsCrossed className="h-5 w-5 text-emerald-300" />

          <p className="mt-3 text-sm text-neutral-400">
            Table Bills
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {sessionBills.length}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Combined dining sessions
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <Banknote className="h-5 w-5 text-amber-300" />

          <p className="mt-3 text-sm text-neutral-400">
            Amount Due
          </p>

          <p className="mt-1 text-2xl font-bold text-white">
            {formatCurrency(
              totalUnpaidAmount
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <CreditCard className="h-5 w-5 text-violet-300" />

          <p className="mt-3 text-sm text-neutral-400">
            Today Collection
          </p>

          <p className="mt-1 text-2xl font-bold text-white">
            {formatCurrency(
              todayCollection
            )}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Cash payments:{" "}
            {cashPaymentsToday}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <ShoppingBag className="h-5 w-5 text-rose-300" />

          <p className="mt-3 text-sm text-neutral-400">
            Takeaway Due
          </p>

          <p className="mt-1 text-3xl font-bold text-white">
            {takeawayOrders.length}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Card / Online today:{" "}
            {
              cardOrOnlinePaymentsToday
            }
          </p>
        </div>
      </section>

      {/* Payment management component */}
      <CashierPaymentManager
        sessionBills={sessionBills}
        singleOrders={singleOrders}
        payments={payments}
      />
    </main>
  );
}