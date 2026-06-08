type Order = {
  _id: string;
  table?: {
    name: string;
  };
  totalAmount: number;
  status: string;
};

export default function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Live Order Flow</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Real-time orders from database.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order._id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div>
              <p className="text-sm font-medium">
                {order.table?.name || "No Table"}
              </p>
              <p className="text-xs text-neutral-500">{order.status}</p>
            </div>

            <p className="text-sm font-medium">
              Rs. {order.totalAmount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}