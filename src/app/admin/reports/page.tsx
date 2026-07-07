import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import Payment from "@/models/Payment";
import { DollarSign, TrendingUp, Users, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

async function getReportsData() {
  await connectDB();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today's data
  const todayOrders = await Order.find({
    createdAt: { $gte: today },
    status: { $ne: "CANCELLED" },
  }).lean();

  const todayCollection = todayOrders
    .filter((o: any) => o.paymentStatus === "PAID")
    .reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

  // Overall stats
  const totalOrders = await Order.countDocuments({ status: { $ne: "CANCELLED" } });
  const completedOrders = await Order.countDocuments({ status: "DELIVERED" });
  const cancelledOrders = await Order.countDocuments({ status: "CANCELLED" });

  const paidOrders = await Order.find({ paymentStatus: "PAID" }).lean();
  const totalPaidCollection = paidOrders.reduce(
    (sum: number, o: any) => sum + (o.totalAmount || 0),
    0
  );

  const unpaidOrders = await Order.find({
    paymentStatus: { $in: ["UNPAID", "PENDING", "PARTIALLY_PAID"] },
    status: { $ne: "CANCELLED" },
  }).lean();

  const totalUnpaidAmount = unpaidOrders.reduce(
    (sum: number, o: any) => sum + (o.totalAmount || 0),
    0
  );

  // Last 7 days sales
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayOrders = await Order.find({
      createdAt: { $gte: date, $lt: nextDay },
      paymentStatus: "PAID",
    }).lean();

    const dayTotal = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    last7Days.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount: dayTotal,
    });
  }

  // Payment method summary
  const payments = await Payment.find().lean();
  const cashCount = payments.filter((p: any) => p.method === "CASH").length;
  const cardCount = payments.filter((p: any) => p.method === "CARD").length;
  const onlineCount = payments.filter((p: any) => p.method === "ONLINE").length;

  // Top selling menu items
  const topMenuItems = await Order.aggregate([
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.menuItem",
        totalSold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
    {
      $project: {
        name: "$menuItem.name",
        totalSold: 1,
        revenue: 1,
      },
    },
  ]);

  // Top selling combos
  const topCombos = await Order.aggregate([
    { $unwind: "$comboItems" },
    {
      $group: {
        _id: "$comboItems.comboOffer",
        totalSold: { $sum: "$comboItems.quantity" },
        revenue: { $sum: { $multiply: ["$comboItems.price", "$comboItems.quantity"] } },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "combooffers",
        localField: "_id",
        foreignField: "_id",
        as: "combo",
      },
    },
    { $unwind: "$combo" },
    {
      $project: {
        name: "$combo.name",
        totalSold: 1,
        revenue: 1,
      },
    },
  ]);

  // Recent paid orders (fixed _id handling)
  const recentPaidOrdersRaw = await Order.find({ paymentStatus: "PAID" })
    .sort({ updatedAt: -1 })
    .limit(8)
    .populate("table")
    .lean();

  const recentPaidOrders = recentPaidOrdersRaw.map((order: any) => ({
    ...order,
    _id: order._id.toString(),
  }));

  return {
    todayCollection,
    todayOrdersCount: todayOrders.length,
    totalOrders,
    completedOrders,
    cancelledOrders,
    totalPaidCollection,
    totalUnpaidAmount,
    last7Days,
    paymentMethods: { cashCount, cardCount, onlineCount },
    topMenuItems,
    topCombos,
    recentPaidOrders,
  };
}

export default async function AdminReportsPage() {
  const data = await getReportsData();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-emerald-300">Admin Reports</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Business Analytics</h1>
        <p className="mt-2 text-neutral-400">Overview of sales, orders and performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="text-emerald-400" size={22} />
            <p className="text-sm text-neutral-400">Today’s Collection</p>
          </div>
          <p className="mt-3 text-4xl font-semibold text-emerald-300">
            Rs. {data.todayCollection.toLocaleString()}
          </p>
          <p className="text-xs text-neutral-500 mt-1">{data.todayOrdersCount} orders today</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-sky-400" size={22} />
            <p className="text-sm text-neutral-400">Total Paid Collection</p>
          </div>
          <p className="mt-3 text-4xl font-semibold text-sky-300">
            Rs. {data.totalPaidCollection.toLocaleString()}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <Users className="text-amber-400" size={22} />
            <p className="text-sm text-neutral-400">Total Orders</p>
          </div>
          <p className="mt-3 text-4xl font-semibold">{data.totalOrders}</p>
          <p className="text-xs text-neutral-500 mt-1">
            {data.completedOrders} completed • {data.cancelledOrders} cancelled
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={22} />
            <p className="text-sm text-neutral-400">Unpaid Amount</p>
          </div>
          <p className="mt-3 text-4xl font-semibold text-red-300">
            Rs. {data.totalUnpaidAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Last 7 Days Sales */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold mb-4">Last 7 Days Sales</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {data.last7Days.map((day, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs text-neutral-400">{day.date}</p>
              <p className="mt-2 text-xl font-semibold text-emerald-300">
                Rs. {day.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Menu Items */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold mb-4">Top Selling Menu Items</h2>
          <div className="space-y-3">
            {data.topMenuItems.length > 0 ? (
              data.topMenuItems.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-neutral-400">{item.totalSold} sold</p>
                  </div>
                  <p className="font-semibold text-emerald-300">Rs. {item.revenue}</p>
                </div>
              ))
            ) : (
              <p className="text-neutral-400 text-sm">No data yet</p>
            )}
          </div>
        </div>

        {/* Top Combos */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold mb-4">Top Selling Combo Offers</h2>
          <div className="space-y-3">
            {data.topCombos.length > 0 ? (
              data.topCombos.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-neutral-400">{item.totalSold} sold</p>
                  </div>
                  <p className="font-semibold text-emerald-300">Rs. {item.revenue}</p>
                </div>
              ))
            ) : (
              <p className="text-neutral-400 text-sm">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold mb-4">Payment Methods</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Cash</span>
              <span className="font-semibold">{data.paymentMethods.cashCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Card</span>
              <span className="font-semibold">{data.paymentMethods.cardCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Online</span>
              <span className="font-semibold">{data.paymentMethods.onlineCount}</span>
            </div>
          </div>
        </div>

        {/* Recent Paid Orders - Fixed */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Paid Orders</h2>
          <div className="space-y-2 text-sm">
            {data.recentPaidOrders.length > 0 ? (
              data.recentPaidOrders.map((order: any) => (
                <div 
                  key={order._id} 
                  className="flex justify-between border-b border-white/10 pb-2 last:border-none"
                >
                  <span>#{order._id.slice(-6).toUpperCase()}</span>
                  <span className="text-emerald-300">
                    Rs. {(order.totalAmount || 0).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-neutral-400 text-sm">No recent paid orders</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}