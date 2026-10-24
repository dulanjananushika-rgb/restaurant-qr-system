import type { ClientSession } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/RecipeItem", () => ({ default: { find: vi.fn() } }));
vi.mock("@/models/InventoryItem", () => ({
  default: { find: vi.fn(), bulkWrite: vi.fn() },
}));
vi.mock("@/models/StockMovement", () => ({ default: { insertMany: vi.fn() } }));

import { deductStockForOrder } from "@/lib/inventory";
import InventoryItem from "@/models/InventoryItem";
import RecipeItem from "@/models/RecipeItem";
import StockMovement from "@/models/StockMovement";

const menuItemId = "64b000000000000000000001";
const inventoryItemId = "64b000000000000000000002";
const orderId = "64b000000000000000000003";
const session = {} as ClientSession;

function queryReturning<T>(value: T) {
  const query = {
    session: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.session.mockReturnValue(query);
  return query;
}

describe("concurrent stock deduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(RecipeItem.find).mockReturnValue(
      queryReturning([
        {
          menuItem: { toString: () => menuItemId },
          inventoryItem: { toString: () => inventoryItemId },
          requiredQuantity: 1,
        },
      ]) as unknown as ReturnType<typeof RecipeItem.find>
    );
    vi.mocked(InventoryItem.find).mockReturnValue(
      queryReturning([
        {
          _id: { toString: () => inventoryItemId },
          name: "Rice",
          unit: "kg",
          quantity: 1,
        },
      ]) as unknown as ReturnType<typeof InventoryItem.find>
    );
    vi.mocked(StockMovement.insertMany).mockResolvedValue([]);
  });

  it("allows only one of two competing deductions to commit", async () => {
    vi.mocked(InventoryItem.bulkWrite)
      .mockResolvedValueOnce({ modifiedCount: 1 } as never)
      .mockResolvedValueOnce({ modifiedCount: 0 } as never);

    const attempts = await Promise.allSettled([
      deductStockForOrder([{ menuItemId, quantity: 1 }], orderId, "first", session),
      deductStockForOrder([{ menuItemId, quantity: 1 }], orderId, "second", session),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "STOCK_CONFLICT", status: 409 },
    });
    expect(StockMovement.insertMany).toHaveBeenCalledTimes(1);
  });
});
