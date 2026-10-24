import { describe, expect, it } from "vitest";

import {
  aggregateQuantities,
  calculateInventoryRequirements,
  calculateItemsTotal,
  groupRecipesByMenuItem,
  mapToMenuQuantities,
} from "@/domain/order/calculations";

describe("order calculations", () => {
  it("aggregates duplicate item quantities in linear time", () => {
    const result = aggregateQuantities(
      [
        { id: "burger", quantity: 1 },
        { id: "rice", quantity: 2 },
        { id: "burger", quantity: 3 },
      ],
      (item) => item.id,
      (item) => item.quantity
    );

    expect(result).toEqual(
      new Map([
        ["burger", 4],
        ["rice", 2],
      ])
    );
  });

  it("ignores invalid quantities", () => {
    const result = aggregateQuantities(
      [
        { id: "valid", quantity: 2 },
        { id: "zero", quantity: 0 },
        { id: "negative", quantity: -1 },
        { id: "nan", quantity: Number.NaN },
      ],
      (item) => item.id,
      (item) => item.quantity
    );
    expect(result).toEqual(new Map([["valid", 2]]));
  });

  it("groups recipes once instead of repeatedly filtering", () => {
    const recipes = [
      { menuItemId: "burger", inventoryItemId: "bun", requiredQuantity: 1 },
      { menuItemId: "burger", inventoryItemId: "meat", requiredQuantity: 0.2 },
      { menuItemId: "tea", inventoryItemId: "milk", requiredQuantity: 0.1 },
    ];
    const grouped = groupRecipesByMenuItem(recipes);
    expect(grouped.get("burger")).toHaveLength(2);
    expect(grouped.get("tea")).toHaveLength(1);
  });

  it("combines inventory shared by several ordered menu items", () => {
    const result = calculateInventoryRequirements(
      new Map([
        ["tea", 2],
        ["coffee", 3],
      ]),
      [
        { menuItemId: "tea", inventoryItemId: "milk", requiredQuantity: 0.1 },
        { menuItemId: "coffee", inventoryItemId: "milk", requiredQuantity: 0.2 },
        { menuItemId: "coffee", inventoryItemId: "coffee", requiredQuantity: 0.03 },
      ]
    );
    expect(result.get("milk")).toBeCloseTo(0.8);
    expect(result.get("coffee")).toBeCloseTo(0.09);
  });

  it("rounds monetary totals to two decimal places", () => {
    expect(
      calculateItemsTotal([
        { price: 10.1, quantity: 2 },
        { price: 5.05, quantity: 1 },
      ])
    ).toBe(25.25);
  });

  it("converts quantity maps to service inputs", () => {
    expect(mapToMenuQuantities(new Map([["a", 2]]))).toEqual([
      { menuItemId: "a", quantity: 2 },
    ]);
  });
});
