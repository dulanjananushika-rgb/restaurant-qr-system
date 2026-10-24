import { describe, expect, it } from "vitest";

import {
  canTransitionOrder,
  getAllowedOrderTransitions,
} from "@/domain/order/status-machine";

describe("order status machine", () => {
  it.each([
    ["PENDING", "ACCEPTED"],
    ["ACCEPTED", "PREPARING"],
    ["PREPARING", "READY"],
    ["READY", "PICKED_UP"],
    ["PICKED_UP", "DELIVERED"],
  ] as const)("allows %s -> %s", (current, next) => {
    expect(canTransitionOrder(current, next)).toBe(true);
  });

  it("allows cancellation only before pickup", () => {
    expect(canTransitionOrder("PENDING", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("READY", "CANCELLED")).toBe(true);
    expect(canTransitionOrder("PICKED_UP", "CANCELLED")).toBe(false);
  });

  it("rejects skipped and reverse transitions", () => {
    expect(canTransitionOrder("PENDING", "READY")).toBe(false);
    expect(canTransitionOrder("READY", "PREPARING")).toBe(false);
  });

  it("treats terminal states as immutable", () => {
    expect(getAllowedOrderTransitions("DELIVERED")).toEqual([]);
    expect(getAllowedOrderTransitions("CANCELLED")).toEqual([]);
  });
});
