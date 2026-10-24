export type BillableOrder = {
  status: string;
  paymentStatus: string;
  totalAmount: number;
};

export type SessionPaymentPlan<T extends BillableOrder> = {
  incompleteCount: number;
  unpaidOrders: T[];
  amount: number;
};

export function buildSessionPaymentPlan<T extends BillableOrder>(
  orders: readonly T[]
): SessionPaymentPlan<T> {
  const incompleteCount = orders.reduce(
    (count, order) => count + (order.status === "DELIVERED" ? 0 : 1),
    0
  );
  const unpaidOrders = orders.filter((order) => order.paymentStatus !== "PAID");
  const amount = Number(
    unpaidOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0).toFixed(2)
  );

  return { incompleteCount, unpaidOrders, amount };
}
