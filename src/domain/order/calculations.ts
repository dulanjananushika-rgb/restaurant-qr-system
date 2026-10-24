import type {
  MenuQuantity,
  PricedItem,
  RecipeRequirement,
} from "@/domain/order/types";

export function aggregateQuantities<T>(
  items: readonly T[],
  getId: (item: T) => string,
  getQuantity: (item: T) => number
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const item of items) {
    const id = getId(item);
    const quantity = getQuantity(item);
    if (!id || !Number.isFinite(quantity) || quantity <= 0) continue;
    totals.set(id, (totals.get(id) ?? 0) + quantity);
  }

  return totals;
}

export function groupRecipesByMenuItem(
  recipes: readonly RecipeRequirement[]
): Map<string, RecipeRequirement[]> {
  const grouped = new Map<string, RecipeRequirement[]>();
  for (const recipe of recipes) {
    const group = grouped.get(recipe.menuItemId);
    if (group) group.push(recipe);
    else grouped.set(recipe.menuItemId, [recipe]);
  }
  return grouped;
}

export function calculateInventoryRequirements(
  menuQuantities: ReadonlyMap<string, number>,
  recipes: readonly RecipeRequirement[]
): Map<string, number> {
  const recipesByMenu = groupRecipesByMenuItem(recipes);
  const requirements = new Map<string, number>();

  for (const [menuItemId, orderedQuantity] of menuQuantities) {
    for (const recipe of recipesByMenu.get(menuItemId) ?? []) {
      const required = recipe.requiredQuantity * orderedQuantity;
      requirements.set(
        recipe.inventoryItemId,
        (requirements.get(recipe.inventoryItemId) ?? 0) + required
      );
    }
  }

  return requirements;
}

export function calculateItemsTotal(items: readonly PricedItem[]): number {
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return Number(total.toFixed(2));
}

export function mapToMenuQuantities(
  quantities: ReadonlyMap<string, number>
): MenuQuantity[] {
  return Array.from(quantities, ([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}
