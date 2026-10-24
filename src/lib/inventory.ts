import mongoose, { type ClientSession, type Types } from "mongoose";

import {
  aggregateQuantities,
  calculateInventoryRequirements,
} from "@/domain/order/calculations";
import type { RecipeRequirement } from "@/domain/order/types";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import { connectDB } from "@/lib/mongodb";
import InventoryItem from "@/models/InventoryItem";
import RecipeItem from "@/models/RecipeItem";
import StockMovement from "@/models/StockMovement";

export type OrderItemInput = {
  menuItemId: string;
  quantity: number;
};

type StockResult = { success: true } | { success: false; message: string };

type RecipeRecord = {
  menuItem: Types.ObjectId;
  inventoryItem: Types.ObjectId;
  requiredQuantity: number;
};

type InventoryRecord = {
  _id: Types.ObjectId;
  name: string;
  unit: string;
  quantity: number;
};

async function buildRequirements(
  items: readonly OrderItemInput[],
  session?: ClientSession
) {
  const menuQuantities = aggregateQuantities(
    items,
    (item) => item.menuItemId,
    (item) => item.quantity
  );

  const query = RecipeItem.find({
    menuItem: { $in: Array.from(menuQuantities.keys()) },
  });
  if (session) query.session(session);

  const recipes = await query.lean<RecipeRecord[]>();
  const normalized: RecipeRequirement[] = recipes.map((recipe) => ({
    menuItemId: recipe.menuItem.toString(),
    inventoryItemId: recipe.inventoryItem.toString(),
    requiredQuantity: Number(recipe.requiredQuantity),
  }));

  return calculateInventoryRequirements(menuQuantities, normalized);
}

async function loadInventory(
  requirements: ReadonlyMap<string, number>,
  session?: ClientSession
) {
  const query = InventoryItem.find({
    _id: { $in: Array.from(requirements.keys()) },
  });
  if (session) query.session(session);

  const records = await query.lean<InventoryRecord[]>();
  return new Map(records.map((item) => [item._id.toString(), item]));
}

export async function validateStockForItems(
  items: readonly OrderItemInput[],
  session?: ClientSession
): Promise<StockResult> {
  await connectDB();
  if (items.length === 0) return { success: true };

  const requirements = await buildRequirements(items, session);
  const inventory = await loadInventory(requirements, session);

  for (const [inventoryId, required] of requirements) {
    const item = inventory.get(inventoryId);
    if (!item) return { success: false, message: "Inventory item not found" };
    if (Number(item.quantity) < required) {
      return {
        success: false,
        message: `Not enough stock for ${item.name}. Required: ${required} ${item.unit}, Available: ${item.quantity} ${item.unit}`,
      };
    }
  }

  return { success: true };
}

async function applyStockChange(
  items: readonly OrderItemInput[],
  orderId: string | Types.ObjectId,
  direction: "DEDUCT" | "RESTORE",
  note: string,
  session: ClientSession
) {
  const requirements = await buildRequirements(items, session);
  if (requirements.size === 0) return;

  const inventory = await loadInventory(requirements, session);

  for (const [inventoryId, required] of requirements) {
    const item = inventory.get(inventoryId);
    if (!item) {
      throw new ApiError(409, "A required inventory item was not found.", "INVENTORY_NOT_FOUND");
    }
    if (direction === "DEDUCT" && Number(item.quantity) < required) {
      throw new ApiError(
        409,
        `Not enough stock for ${item.name}. Required: ${required} ${item.unit}, Available: ${item.quantity} ${item.unit}`,
        "INSUFFICIENT_STOCK"
      );
    }
  }

  const multiplier = direction === "DEDUCT" ? -1 : 1;
  const result = await InventoryItem.bulkWrite(
    Array.from(requirements, ([inventoryId, quantity]) => ({
      updateOne: {
        filter: {
          _id: new mongoose.Types.ObjectId(inventoryId),
          ...(direction === "DEDUCT" ? { quantity: { $gte: quantity } } : {}),
        },
        update: { $inc: { quantity: multiplier * quantity } },
      },
    })),
    { session, ordered: true }
  );

  if (result.modifiedCount !== requirements.size) {
    throw new ApiError(409, "Inventory changed while the order was updated.", "STOCK_CONFLICT");
  }

  await StockMovement.insertMany(
    Array.from(requirements, ([inventoryId, quantity]) => {
      const item = inventory.get(inventoryId);
      if (!item) throw new ApiError(500, "Inventory snapshot is missing.");
      const previousQuantity = Number(item.quantity);
      const newQuantity = previousQuantity + multiplier * quantity;
      return {
        inventoryItem: item._id,
        type: direction === "DEDUCT" ? "STOCK_OUT" : "STOCK_IN",
        quantity: multiplier * quantity,
        previousQuantity,
        newQuantity,
        referenceType: "ORDER",
        referenceId: orderId,
        reason: note,
      };
    }),
    { session }
  );
}

export async function deductStockForOrder(
  items: readonly OrderItemInput[],
  orderId: string | Types.ObjectId,
  note = "Stock deducted for order",
  session?: ClientSession
) {
  if (session) return applyStockChange(items, orderId, "DEDUCT", note, session);
  return runInTransaction((transactionSession) =>
    applyStockChange(items, orderId, "DEDUCT", note, transactionSession)
  );
}

export async function restoreStockForOrder(
  items: readonly OrderItemInput[],
  orderId: string | Types.ObjectId,
  note = "Stock restored due to order edit",
  session?: ClientSession
) {
  if (session) return applyStockChange(items, orderId, "RESTORE", note, session);
  return runInTransaction((transactionSession) =>
    applyStockChange(items, orderId, "RESTORE", note, transactionSession)
  );
}
