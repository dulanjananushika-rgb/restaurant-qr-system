import Link from "next/link";

import {
  AlertTriangle,
  BarChart3,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  Package,
  ReceiptText,
  TrendingUp,
  Truck,
} from "lucide-react";

import { connectDB } from "@/lib/mongodb";

import Order from "@/models/Order";
import Payment from "@/models/Payment";
import InventoryItem from "@/models/InventoryItem";

import "@/models/Table";
import "@/models/MenuItem";
import "@/models/ComboOffer";
import "@/models/DiningSession";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/* =========================
   Types
========================= */

type ReferenceData =
  | string
  | {
      _id?: string;
    }
  | null;

type TableData = {
  _id: string;
  name: string;
};

type MenuItemData = {
  _id: string;
  name: string;
};

type ComboOfferData = {
  _id: string;
  name: string;
};

type OrderItemData = {
  _id: string;
  menuItem?: MenuItemData | null;
  quantity: number;
  price: number;
};

type OrderComboItemData = {
  _id: string;
  comboOffer?: ComboOfferData | null;
  quantity: number;
  price: number;
};

type OrderData = {
  _id: string;

  table?: TableData | null;
  diningSession?: ReferenceData;

  orderType:
    | "DINE_IN"
    | "TAKE_AWAY"
    | "ONLINE";

  customerName?: string;

  items?: OrderItemData[];
  comboItems?: OrderComboItemData[];

  totalAmount: number;

  status:
    | "PENDING"
    | "ACCEPTED"
    | "PREPARING"
    | "READY"
    | "PICKED_UP"
    | "DELIVERED"
    | "CANCELLED";

  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "FAILED"
    | "PARTIALLY_PAID";

  paymentType:
    | "PAY_NOW"
    | "PAY_LATER";

  createdAt: string;
  updatedAt: string;
};

type InventoryData = {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number;
};

type PendingBillData = {
  key: string;

  type:
    | "SESSION"
    | "ORDER";

  title: string;
  description: string;

  amount: number;
  orderCount: number;

  createdAt: string;
};

type SellingItemData = {
  key: string;

  type:
    | "MENU_ITEM"
    | "COMBO";

  name: string;
  quantity: number;
  revenue: number;
};

/* =========================
   Formatting helpers
========================= */

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
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function getReferenceId(
  reference?: ReferenceData
) {
  if (!reference) {
    return "";
  }

  if (typeof reference === "string") {
    return reference;
  }

  return reference._id
    ? String(reference._id)
    : "";
}

function getOrderNumber(orderId: string) {
  return orderId
    .slice(-6)
    .toUpperCase();
}

function getOrderItemCount(
  order: OrderData
) {
  const normalItemCount =
    order.items?.reduce(
      (total, item) =>
        total +
        Number(item.quantity || 0),
      0
    ) || 0;

  const comboItemCount =
    order.comboItems?.reduce(
      (total, combo) =>
        total +
        Number(combo.quantity || 0),
      0
    ) || 0;

  return normalItemCount + comboItemCount;
}

function statusBadge(status: string) {
  if (
    status === "PAID" ||
    status === "READY" ||
    status === "DELIVERED"
  ) {
    return (
      "border-emerald-500/20 " +
      "bg-emerald-500/10 " +
      "text-emerald-300"
    );
  }

  if (
    status === "PENDING" ||
    status === "UNPAID" ||
    status === "PARTIALLY_PAID"
  ) {
    return (
      "border-amber-500/20 " +
      "bg-amber-500/10 " +
      "text-amber-300"
    );
  }

  if (
    status === "ACCEPTED" ||
    status === "PREPARING" ||
    status === "PICKED_UP"
  ) {
    return (
      "border-sky-500/20 " +
      "bg-sky-500/10 " +
      "text-sky-300"
    );
  }

  if (
    status === "CANCELLED" ||
    status === "FAILED"
  ) {
    return (
      "border-red-500/20 " +
      "bg-red-500/10 " +
      "text-red-300"
    );
  }

  return (
    "border-white/10 " +
    "bg-white/5 " +
    "text-neutral-300"
  );
}

/* =========================
   Combined pending bills
========================= */

function buildPendingBills(
  unpaidOrders: OrderData[]
) {
  const sessionBillMap =
    new Map<string, PendingBillData>();

  const individualBills:
    PendingBillData[] = [];

  for (const order of unpaidOrders) {
    const diningSessionId =
      getReferenceId(
        order.diningSession
      );

    const belongsToDiningSession =
      order.orderType === "DINE_IN" &&
      Boolean(diningSessionId);

    if (belongsToDiningSession) {
      const existingBill =
        sessionBillMap.get(
          diningSessionId
        );

      if (existingBill) {
        existingBill.amount += Number(
          order.totalAmount || 0
        );

        existingBill.orderCount += 1;

        const currentOrderTime =
          new Date(
            order.createdAt
          ).getTime();

        const existingBillTime =
          new Date(
            existingBill.createdAt
          ).getTime();

        if (
          currentOrderTime <
          existingBillTime
        ) {
          existingBill.createdAt =
            order.createdAt;
        }

        continue;
      }

      sessionBillMap.set(
        diningSessionId,
        {
          key:
            `session:${diningSessionId}`,

          type: "SESSION",

          title:
            order.table?.name ||
            "Dining Table",

          description:
            "Combined dining-session bill",

          amount: Number(
            order.totalAmount || 0
          ),

          orderCount: 1,

          createdAt:
            order.createdAt,
        }
      );

      continue;
    }

    individualBills.push({
      key: `order:${order._id}`,

      type: "ORDER",

      title:
        order.orderType ===
        "TAKE_AWAY"
          ? `Takeaway #${getOrderNumber(
              order._id
            )}`
          : `Order #${getOrderNumber(
              order._id
            )}`,

      description:
        order.table?.name ||
        "Counter Pickup",

      amount: Number(
        order.totalAmount || 0
      ),

      orderCount: 1,

      createdAt:
        order.createdAt,
    });
  }

  const sessionBills =
    Array.from(
      sessionBillMap.values()
    );

  const allBills = [
    ...sessionBills,
    ...individualBills,
  ].sort(
    (firstBill, secondBill) =>
      new Date(
        secondBill.createdAt
      ).getTime() -
      new Date(
        firstBill.createdAt
      ).getTime()
  );

  return {
    bills: allBills,

    sessionBillCount:
      sessionBills.length,

    individualBillCount:
      individualBills.length,

    totalBillCount:
      allBills.length,

    totalAmount:
      unpaidOrders.reduce(
        (total, order) =>
          total +
          Number(
            order.totalAmount || 0
          ),
        0
      ),
  };
}

/* =========================
   Today's top selling
========================= */

function buildTopSellingItems(
  todayOrders: OrderData[]
) {
  const sellingMap =
    new Map<
      string,
      SellingItemData
    >();

  function addSale(
    key: string,
    type:
      | "MENU_ITEM"
      | "COMBO",
    name: string,
    quantity: number,
    revenue: number
  ) {
    const existing =
      sellingMap.get(key);

    if (existing) {
      existing.quantity += quantity;
      existing.revenue += revenue;
      return;
    }

    sellingMap.set(key, {
      key,
      type,
      name,
      quantity,
      revenue,
    });
  }

  for (const order of todayOrders) {
    if (order.status === "CANCELLED") {
      continue;
    }

    for (
      const item of order.items || []
    ) {
      const itemName =
        item.menuItem?.name ||
        "Menu item";

      const itemId =
        item.menuItem?._id ||
        itemName;

      const quantity = Number(
        item.quantity || 0
      );

      const revenue =
        Number(item.price || 0) *
        quantity;

      addSale(
        `menu:${itemId}`,
        "MENU_ITEM",
        itemName,
        quantity,
        revenue
      );
    }

    for (
      const combo of
        order.comboItems || []
    ) {
      const comboName =
        combo.comboOffer?.name ||
        "Combo offer";

      const comboId =
        combo.comboOffer?._id ||
        comboName;

      const quantity = Number(
        combo.quantity || 0
      );

      const revenue =
        Number(combo.price || 0) *
        quantity;

      addSale(
        `combo:${comboId}`,
        "COMBO",
        comboName,
        quantity,
        revenue
      );
    }
  }

  return Array.from(
    sellingMap.values()
  )
    .sort(
      (firstItem, secondItem) =>
        secondItem.quantity -
          firstItem.quantity ||
        secondItem.revenue -
          firstItem.revenue
    )
    .slice(0, 6);
}

/* =========================
   Database data
========================= */

async function getDashboardData() {
  await connectDB();

  const startOfToday =
    new Date();

  startOfToday.setHours(
    0,
    0,
    0,
    0
  );

  const endOfToday =
    new Date();

  endOfToday.setHours(
    23,
    59,
    59,
    999
  );

  const [
    todayPaymentSummary,
    totalPaymentSummary,
    todayOrderDocuments,
    activeOrderCount,
    readyOrderCount,
    unpaidOrderDocuments,
    inventoryDocuments,
    recentOrderDocuments,
    statusSummary,
  ] = await Promise.all([
    /*
     * Revenue is calculated using actual
     * PAID payment records and paidAt.
     */
    Payment.aggregate([
      {
        $match: {
          status: "PAID",
        },
      },

      {
        $addFields: {
          effectivePaidAt: {
            $ifNull: [
              "$paidAt",
              "$createdAt",
            ],
          },
        },
      },

      {
        $match: {
          effectivePaidAt: {
            $gte: startOfToday,
            $lte: endOfToday,
          },
        },
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: "$amount",
          },

          count: {
            $sum: 1,
          },
        },
      },
    ]),

    /*
     * Combined payments are counted once
     * because the Payment document stores
     * the final paid amount.
     */
    Payment.aggregate([
      {
        $match: {
          status: "PAID",
        },
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: "$amount",
          },

          count: {
            $sum: 1,
          },
        },
      },
    ]),

    /*
     * Today's valid orders are used for
     * order count and top-selling results.
     */
    Order.find({
      createdAt: {
        $gte: startOfToday,
        $lte: endOfToday,
      },

      status: {
        $ne: "CANCELLED",
      },
    })
      .populate("table")
      .populate(
        "items.menuItem"
      )
      .populate(
        "comboItems.comboOffer"
      )
      .lean(),

    /*
     * Active preparation workflow.
     * READY orders are displayed separately.
     */
    Order.countDocuments({
      status: {
        $in: [
          "PENDING",
          "ACCEPTED",
          "PREPARING",
        ],
      },
    }),

    Order.countDocuments({
      status: "READY",
    }),

    /*
     * Load unpaid orders and convert
     * same-session dine-in orders into
     * one combined pending bill.
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
      .populate(
        "diningSession"
      )
      .lean(),

    /*
     * Load every low-stock item so the
     * dashboard card shows the real count.
     */
    InventoryItem.find({
      $expr: {
        $lte: [
          "$quantity",
          "$minQuantity",
        ],
      },
    })
      .sort({
        quantity: 1,
      })
      .lean(),

    /*
     * Recent orders include menu items
     * and combo offers.
     */
    Order.find()
      .sort({
        createdAt: -1,
      })
      .limit(8)
      .populate("table")
      .populate(
        "items.menuItem"
      )
      .populate(
        "comboItems.comboOffer"
      )
      .lean(),

    /*
     * Overall order workflow counts.
     */
    Order.aggregate([
      {
        $group: {
          _id: "$status",

          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);

  const todayOrders =
    JSON.parse(
      JSON.stringify(
        todayOrderDocuments
      )
    ) as OrderData[];

  const unpaidOrders =
    JSON.parse(
      JSON.stringify(
        unpaidOrderDocuments
      )
    ) as OrderData[];

  const lowStockItems =
    JSON.parse(
      JSON.stringify(
        inventoryDocuments
      )
    ) as InventoryData[];

  const recentOrders =
    JSON.parse(
      JSON.stringify(
        recentOrderDocuments
      )
    ) as OrderData[];

  const pendingBills =
    buildPendingBills(
      unpaidOrders
    );

  const topSellingItems =
    buildTopSellingItems(
      todayOrders
    );

  const orderStatusCounts:
    Record<string, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      PREPARING: 0,
      READY: 0,
      PICKED_UP: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

  for (
    const statusRecord of
      statusSummary as Array<{
        _id: string;
        count: number;
      }>
  ) {
    orderStatusCounts[
      statusRecord._id
    ] = Number(
      statusRecord.count || 0
    );
  }

  return {
    cards: {
      todayRevenue: Number(
        todayPaymentSummary[0]
          ?.total || 0
      ),

      todayPaymentCount: Number(
        todayPaymentSummary[0]
          ?.count || 0
      ),

      totalRevenue: Number(
        totalPaymentSummary[0]
          ?.total || 0
      ),

      totalPaymentCount: Number(
        totalPaymentSummary[0]
          ?.count || 0
      ),

      todayOrders:
        todayOrders.length,

      activeOrders:
        Number(
          activeOrderCount || 0
        ),

      readyOrders:
        Number(
          readyOrderCount || 0
        ),

      pendingBills:
        pendingBills.totalBillCount,

      pendingAmount:
        pendingBills.totalAmount,

      lowStockItems:
        lowStockItems.length,
    },

    orderStatusCounts,

    recentOrders,

    lowStockItems:
      lowStockItems.slice(0, 8),

    pendingBills:
      pendingBills.bills.slice(
        0,
        8
      ),

    pendingBillSummary: {
      sessionBills:
        pendingBills.sessionBillCount,

      individualBills:
        pendingBills.individualBillCount,
    },

    topSellingItems,
  };
}

/* =========================
   Page
========================= */

export default async function AdminDashboardPage() {
  const data =
    await getDashboardData();

  const summaryCards = [
    {
      title: "Today Revenue",

      value: formatCurrency(
        data.cards.todayRevenue
      ),

      description:
        `${data.cards.todayPaymentCount} paid payment(s) today`,

      icon: CircleDollarSign,

      iconClass:
        "bg-emerald-500/10 text-emerald-300",
    },

    {
      title: "Total Revenue",

      value: formatCurrency(
        data.cards.totalRevenue
      ),

      description:
        `${data.cards.totalPaymentCount} completed payment(s)`,

      icon: TrendingUp,

      iconClass:
        "bg-sky-500/10 text-sky-300",
    },

    {
      title: "Orders Today",

      value:
        data.cards.todayOrders,

      description:
        "Non-cancelled orders created today",

      icon: ClipboardList,

      iconClass:
        "bg-violet-500/10 text-violet-300",
    },

    {
      title: "Active Orders",

      value:
        data.cards.activeOrders,

      description:
        "Pending, accepted and preparing",

      icon: Clock3,

      iconClass:
        "bg-amber-500/10 text-amber-300",
    },

    {
      title: "Ready Orders",

      value:
        data.cards.readyOrders,

      description:
        "Waiting for waiter pickup",

      icon: ChefHat,

      iconClass:
        "bg-teal-500/10 text-teal-300",
    },

    {
      title: "Pending Bills",

      value:
        data.cards.pendingBills,

      description:
        formatCurrency(
          data.cards.pendingAmount
        ),

      icon: CreditCard,

      iconClass:
        "bg-orange-500/10 text-orange-300",
    },

    {
      title: "Low Stock",

      value:
        data.cards.lowStockItems,

      description:
        "At or below minimum quantity",

      icon: Package,

      iconClass:
        "bg-red-500/10 text-red-300",
    },
  ];

  const workflowStatuses = [
    {
      status: "PENDING",
      label: "Pending",
    },

    {
      status: "ACCEPTED",
      label: "Accepted",
    },

    {
      status: "PREPARING",
      label: "Preparing",
    },

    {
      status: "READY",
      label: "Ready",
    },

    {
      status: "PICKED_UP",
      label: "Picked Up",
    },

    {
      status: "DELIVERED",
      label: "Delivered",
    },
  ];

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-sky-500/5 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Restaurant Command Center
            </p>

            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Welcome back, Admin
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
              Monitor actual payment
              collection, order workflow,
              combined table bills and
              inventory alerts.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/20"
            >
              <ClipboardList className="h-4 w-4" />
              View Orders
            </Link>

            <Link
              href="/admin/reports"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-400"
            >
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Link>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(
          (card) => {
            const Icon =
              card.icon;

            return (
              <article
                key={card.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-400">
                      {card.title}
                    </p>

                    <p className="mt-3 text-2xl font-bold text-white">
                      {card.value}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-neutral-500">
                      {card.description}
                    </p>
                  </div>

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </article>
            );
          }
        )}
      </section>

      {/* Workflow and Recent Orders */}
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        {/* Order Workflow */}
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-emerald-400">
              Live Workflow
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Order Status Summary
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Current order count for each
              restaurant workflow stage.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {workflowStatuses.map(
              (item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <span className="text-sm text-neutral-400">
                    {item.label}
                  </span>

                  <span className="text-lg font-bold text-white">
                    {data
                      .orderStatusCounts[
                      item.status
                    ] || 0}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <span className="text-sm text-red-200">
              Cancelled
            </span>

            <span className="text-lg font-bold text-red-300">
              {data
                .orderStatusCounts
                .CANCELLED || 0}
            </span>
          </div>
        </article>

        {/* Recent Orders */}
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-400">
                Latest Activity
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                Recent Orders
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                Latest dine-in and takeaway
                customer orders.
              </p>
            </div>

            <Link
              href="/admin/orders"
              className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
            >
              View all
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {data.recentOrders.length >
            0 ? (
              data.recentOrders.map(
                (order) => (
                  <div
                    key={order._id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-white">
                          Order #
                          {getOrderNumber(
                            order._id
                          )}
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          {order.table
                            ?.name ||
                            (order.orderType ===
                            "TAKE_AWAY"
                              ? "Takeaway"
                              : "Online Order")}
                          {" • "}
                          {formatDateTime(
                            order.createdAt
                          )}
                        </p>
                      </div>

                      <p className="font-bold text-white">
                        {formatCurrency(
                          order.totalAmount
                        )}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge(
                          order.status
                        )}`}
                      >
                        {formatStatus(
                          order.status
                        )}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge(
                          order.paymentStatus
                        )}`}
                      >
                        {formatStatus(
                          order.paymentStatus
                        )}
                      </span>

                      <span className="text-xs text-neutral-500">
                        {getOrderItemCount(
                          order
                        )}{" "}
                        item(s)
                      </span>
                    </div>
                  </div>
                )
              )
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-neutral-500">
                No recent orders.
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Pending Bills and Low Stock */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Pending Bills */}
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-400">
                Cashier Attention
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                Pending Bills
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                Same-table orders are counted
                as one combined dining bill.
              </p>

              <p className="mt-2 text-xs text-neutral-600">
                {
                  data
                    .pendingBillSummary
                    .sessionBills
                }{" "}
                table bill(s) •{" "}
                {
                  data
                    .pendingBillSummary
                    .individualBills
                }{" "}
                individual bill(s)
              </p>
            </div>

            <Link
              href="/cashier/orders"
              className="inline-flex items-center gap-2 text-sm font-semibold text-amber-400 transition hover:text-amber-300"
            >
              <ReceiptText className="h-4 w-4" />
              Cashier
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {data.pendingBills.length >
            0 ? (
              data.pendingBills.map(
                (bill) => (
                  <div
                    key={bill.key}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">
                          {bill.title}
                        </p>

                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          {bill.type ===
                          "SESSION"
                            ? "COMBINED"
                            : "INDIVIDUAL"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-neutral-500">
                        {bill.type ===
                        "SESSION"
                          ? `${bill.orderCount} orders`
                          : bill.description}
                        {" • "}
                        {formatDateTime(
                          bill.createdAt
                        )}
                      </p>
                    </div>

                    <p className="shrink-0 font-bold text-amber-200">
                      {formatCurrency(
                        bill.amount
                      )}
                    </p>
                  </div>
                )
              )
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-emerald-300" />

                <p className="mt-3 font-semibold text-emerald-100">
                  No pending bills
                </p>

                <p className="mt-1 text-sm text-emerald-200/60">
                  All available bills have
                  been settled.
                </p>
              </div>
            )}
          </div>
        </article>

        {/* Low Stock */}
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-400">
                Inventory Attention
              </p>

              <h2 className="mt-1 text-xl font-bold text-white">
                Low Stock Alerts
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                Items at or below their
                configured minimum quantity.
              </p>
            </div>

            <Link
              href="/admin/inventory"
              className="inline-flex items-center gap-2 text-sm font-semibold text-red-400 transition hover:text-red-300"
            >
              <Package className="h-4 w-4" />
              Inventory
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {data.lowStockItems.length >
            0 ? (
              data.lowStockItems.map(
                (item) => {
                  const shortage =
                    Math.max(
                      0,
                      Number(
                        item.minQuantity ||
                          0
                      ) -
                        Number(
                          item.quantity ||
                            0
                        )
                    );

                  return (
                    <div
                      key={item._id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-red-500/15 bg-red-500/[0.04] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />

                        <div>
                          <p className="font-semibold text-white">
                            {item.name}
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            Minimum:{" "}
                            {
                              item.minQuantity
                            }{" "}
                            {item.unit}

                            {shortage >
                              0 &&
                              ` • Short by ${shortage} ${item.unit}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-red-300">
                          {item.quantity}{" "}
                          {item.unit}
                        </p>

                        <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                          Current
                        </p>
                      </div>
                    </div>
                  );
                }
              )
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8 text-center">
                <Package className="mx-auto h-8 w-8 text-emerald-300" />

                <p className="mt-3 font-semibold text-emerald-100">
                  Stock levels are healthy
                </p>

                <p className="mt-1 text-sm text-emerald-200/60">
                  No low-stock alerts at the
                  moment.
                </p>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Top Selling */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-sky-400">
              Today&apos;s Performance
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              Top Selling Items and Combos
            </h2>

            <p className="mt-2 text-sm text-neutral-500">
              Ranked using today&apos;s
              non-cancelled order quantities.
            </p>
          </div>

          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-400 transition hover:text-sky-300"
          >
            <BarChart3 className="h-4 w-4" />
            Reports
          </Link>
        </div>

        {data.topSellingItems.length >
        0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.topSellingItems.map(
              (item, index) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-bold text-white">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {item.name}
                        </p>

                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            item.type ===
                            "COMBO"
                              ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
                              : "border-sky-500/20 bg-sky-500/10 text-sky-300"
                          }`}
                        >
                          {item.type ===
                          "COMBO"
                            ? "COMBO OFFER"
                            : "MENU ITEM"}
                        </span>
                      </div>
                    </div>

                    {item.type ===
                    "COMBO" ? (
                      <Truck className="h-5 w-5 shrink-0 text-violet-300" />
                    ) : (
                      <ChefHat className="h-5 w-5 shrink-0 text-sky-300" />
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-neutral-500">
                        Quantity sold
                      </p>

                      <p className="mt-1 text-lg font-bold text-white">
                        {item.quantity}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-neutral-500">
                        Sales value
                      </p>

                      <p className="mt-1 font-bold text-emerald-300">
                        {formatCurrency(
                          item.revenue
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-neutral-500">
            No sales data is available for
            today.
          </div>
        )}
      </section>
    </main>
  );
}