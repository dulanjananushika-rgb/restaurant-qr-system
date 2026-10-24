import { describe, expect, it } from "vitest";

import {
  cashierPaymentSchema,
  createOrderSchema,
  publicOrderUpdateSchema,
} from "@/validation/order";

const id = "507f1f77bcf86cd799439011";

describe("order request validation", () => {
  it("requires a table for dine-in orders", () => {
    const result = createOrderSchema.safeParse({
      orderType: "DINE_IN",
      paymentType: "PAY_LATER",
      items: [{ menuItemId: id, quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a takeaway combo-only order", () => {
    const result = createOrderSchema.safeParse({
      orderType: "TAKE_AWAY",
      paymentType: "PAY_NOW",
      comboItems: [{ comboOfferId: id, quantity: "2" }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.comboItems[0].quantity).toBe(2);
  });

  it("rejects empty orders and malformed identifiers", () => {
    expect(
      createOrderSchema.safeParse({
        orderType: "TAKE_AWAY",
        paymentType: "PAY_LATER",
      }).success
    ).toBe(false);
    expect(
      createOrderSchema.safeParse({
        orderType: "TAKE_AWAY",
        paymentType: "PAY_LATER",
        items: [{ menuItemId: "bad", quantity: 1 }],
      }).success
    ).toBe(false);
  });

  it("allows combo items when editing an order", () => {
    expect(
      publicOrderUpdateSchema.safeParse({
        editToken: "a".repeat(64),
        comboItems: [{ comboOfferId: id, quantity: 1 }],
      }).success
    ).toBe(true);
  });

  it("requires exactly one cashier payment target", () => {
    expect(
      cashierPaymentSchema.safeParse({ orderId: id, method: "CASH" }).success
    ).toBe(true);
    expect(
      cashierPaymentSchema.safeParse({
        orderId: id,
        diningSessionId: id,
        method: "CARD",
      }).success
    ).toBe(false);
    expect(cashierPaymentSchema.safeParse({ method: "CASH" }).success).toBe(false);
  });
});
