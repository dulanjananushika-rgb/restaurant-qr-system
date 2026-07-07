import { connectDB } from "@/lib/mongodb";
import InventoryItem from "@/models/InventoryItem";
import RecipeItem from "@/models/RecipeItem";
import StockMovement from "@/models/StockMovement";

interface OrderItemInput {
  menuItemId: string;
  quantity: number;
}

interface StockResult {
  success: boolean;
  message?: string;
}

/**
 * Build total inventory requirement from order items
 */
async function buildDeductionMap(items: OrderItemInput[]) {
  const menuMap = new Map<string, number>();

  for (const item of items) {
    const current = menuMap.get(item.menuItemId) || 0;
    menuMap.set(item.menuItemId, current + item.quantity);
  }

  const menuIds = Array.from(menuMap.keys());
  const recipes = await RecipeItem.find({
    menuItem: { $in: menuIds },
  }).lean();

  const deductionMap = new Map<string, number>();

  for (const [menuId, qty] of menuMap.entries()) {
    const itemRecipes = recipes.filter(
      (r: any) => r.menuItem.toString() === menuId
    );

    for (const recipe of itemRecipes as any[]) {
      const invId = recipe.inventoryItem.toString();
      const required = Number(recipe.requiredQuantity || 0) * qty;

      const current = deductionMap.get(invId) || 0;
      deductionMap.set(invId, current + required);
    }
  }

  return deductionMap;
}

/**
 * Check if enough stock is available before creating/updating order
 */
export async function validateStockForItems(
  items: OrderItemInput[]
): Promise<StockResult> {
  await connectDB();

  if (!items || items.length === 0) {
    return { success: true };
  }

  const deductionMap = await buildDeductionMap(items);

  for (const [invId, required] of deductionMap.entries()) {
    const inv = await InventoryItem.findById(invId);

    if (!inv) {
      return { success: false, message: "Inventory item not found" };
    }

    if (inv.quantity < required) {
      return {
        success: false,
        message: `Not enough stock for ${inv.name}. Required: ${required} ${inv.unit}, Available: ${inv.quantity} ${inv.unit}`,
      };
    }
  }

  return { success: true };
}

/**
 * Deduct stock from inventory + create StockMovement records
 */
export async function deductStockForOrder(
  items: OrderItemInput[],
  orderId: string,
  note = "Stock deducted for order"
) {
  await connectDB();

  const deductionMap = await buildDeductionMap(items);
  const movements: any[] = [];

  for (const [invId, qty] of deductionMap.entries()) {
    const inv = await InventoryItem.findById(invId);
    if (!inv) continue;

    const previous = inv.quantity;
    inv.quantity = Math.max(0, inv.quantity - qty);
    await inv.save();

    movements.push({
      inventoryItem: inv._id,
      type: "OUT",
      quantity: qty,
      previousQuantity: previous,
      newQuantity: inv.quantity,
      referenceType: "ORDER",
      referenceId: orderId,
      reason: note,
    });
  }

  if (movements.length > 0) {
    await StockMovement.insertMany(movements);
  }
}

/**
 * Restore stock (used when editing a pending order)
 */
export async function restoreStockForOrder(
  items: OrderItemInput[],
  orderId: string,
  note = "Stock restored due to order edit"
) {
  await connectDB();

  const deductionMap = await buildDeductionMap(items);
  const movements: any[] = [];

  for (const [invId, qty] of deductionMap.entries()) {
    const inv = await InventoryItem.findById(invId);
    if (!inv) continue;

    const previous = inv.quantity;
    inv.quantity = previous + qty;
    await inv.save();

    movements.push({
      inventoryItem: inv._id,
      type: "IN",
      quantity: qty,
      previousQuantity: previous,
      newQuantity: inv.quantity,
      referenceType: "ORDER",
      referenceId: orderId,
      reason: note,
    });
  }

  if (movements.length > 0) {
    await StockMovement.insertMany(movements);
  }
}