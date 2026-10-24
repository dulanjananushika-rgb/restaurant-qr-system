import { describe, expect, it } from "vitest";

import { buildSessionPaymentPlan } from "@/domain/payment/billing";

describe("combined dining-session billing", () => {
  it("charges only unpaid delivered orders", () => {
    const plan = buildSessionPaymentPlan([
      { id: "paid", status: "DELIVERED", paymentStatus: "PAID", totalAmount: 500 },
      { id: "one", status: "DELIVERED", paymentStatus: "UNPAID", totalAmount: 1000.1 },
      { id: "two", status: "DELIVERED", paymentStatus: "PENDING", totalAmount: 499.95 },
    ]);

    expect(plan.incompleteCount).toBe(0);
    expect(plan.unpaidOrders.map((order) => order.id)).toEqual(["one", "two"]);
    expect(plan.amount).toBe(1500.05);
  });

  it("detects incomplete orders before settlement", () => {
    const plan = buildSessionPaymentPlan([
      { status: "READY", paymentStatus: "UNPAID", totalAmount: 100 },
      { status: "DELIVERED", paymentStatus: "UNPAID", totalAmount: 200 },
    ]);
    expect(plan.incompleteCount).toBe(1);
  });

  it("returns an empty payment plan when every order is paid", () => {
    const plan = buildSessionPaymentPlan([
      { status: "DELIVERED", paymentStatus: "PAID", totalAmount: 100 },
    ]);
    expect(plan.unpaidOrders).toEqual([]);
    expect(plan.amount).toBe(0);
  });
});
