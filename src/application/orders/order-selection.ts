import { type ClientSession, type Types } from "mongoose";

import {
  calculateInventoryRequirements,
  calculateItemsTotal,
} from "@/domain/order/calculations";
import type { RecipeRequirement } from "@/domain/order/types";
import { ApiError } from "@/lib/api/errors";
import ComboOffer from "@/models/ComboOffer";
import MenuItem from "@/models/MenuItem";
import RecipeItem from "@/models/RecipeItem";

type MenuRecord = {
  _id: Types.ObjectId;
  name: string;
  price: number;
  available: boolean;
};

type ComboRecord = {
  _id: Types.ObjectId;
  name: string;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  originalPrice: number;
  offerPrice: number;
  items: Array<{
    menuItem: Types.ObjectId;
    quantity: number;
    priceSnapshot: number;
  }>;
};

type RecipeRecord = {
  menuItem: Types.ObjectId;
  inventoryItem: Types.ObjectId;
  requiredQuantity: number;
};

export type ResolvedOrderItem = {
  menuItem: Types.ObjectId;
  quantity: number;
  price: number;
};

export type ResolvedComboItem = {
  comboOffer: Types.ObjectId;
  quantity: number;
  price: number;
  originalPrice: number;
  comboItemsSnapshot: Array<{
    menuItem: Types.ObjectId;
    name: string;
    quantity: number;
    priceSnapshot: number;
  }>;
};

export type ResolvedOrderSelection = {
  orderItems: ResolvedOrderItem[];
  orderComboItems: ResolvedComboItem[];
  totalAmount: number;
  requirements: Map<string, number>;
};

function id(value: Types.ObjectId): string {
  return value.toString();
}

function isComboActive(combo: ComboRecord, now: Date): boolean {
  return (
    combo.active &&
    (!combo.startDate || combo.startDate <= now) &&
    (!combo.endDate || combo.endDate >= now)
  );
}

export async function resolveOrderSelection(
  normalQuantities: ReadonlyMap<string, number>,
  comboQuantities: ReadonlyMap<string, number>,
  session: ClientSession
): Promise<ResolvedOrderSelection> {
  if (normalQuantities.size === 0 && comboQuantities.size === 0) {
    throw new ApiError(400, "Please add at least one item to the order.", "EMPTY_ORDER");
  }

  const comboIds = Array.from(comboQuantities.keys());
  const combos = comboIds.length
    ? await ComboOffer.find({ _id: { $in: comboIds } })
        .session(session)
        .lean<ComboRecord[]>()
    : [];

  if (combos.length !== comboIds.length) {
    throw new ApiError(400, "Some selected combo offers are invalid.", "INVALID_COMBO");
  }

  const now = new Date();
  for (const combo of combos) {
    if (!isComboActive(combo, now)) {
      throw new ApiError(409, `${combo.name} is not active at this time.`, "COMBO_INACTIVE");
    }
  }

  const allMenuIds = new Set(normalQuantities.keys());
  for (const combo of combos) {
    for (const item of combo.items) allMenuIds.add(id(item.menuItem));
  }

  const menuRecords = await MenuItem.find({
    _id: { $in: Array.from(allMenuIds) },
    available: true,
  })
    .session(session)
    .lean<MenuRecord[]>();

  const menuById = new Map(menuRecords.map((item) => [id(item._id), item]));
  if (menuById.size !== allMenuIds.size) {
    throw new ApiError(409, "Some selected menu items are unavailable.", "MENU_ITEM_UNAVAILABLE");
  }

  const orderItems = Array.from(normalQuantities, ([menuItemId, quantity]) => {
    const menu = menuById.get(menuItemId);
    if (!menu) throw new ApiError(409, "A selected menu item is unavailable.", "MENU_ITEM_UNAVAILABLE");
    return { menuItem: menu._id, quantity, price: Number(menu.price) };
  });

  const comboById = new Map(combos.map((combo) => [id(combo._id), combo]));
  const orderComboItems = Array.from(comboQuantities, ([comboId, quantity]) => {
    const combo = comboById.get(comboId);
    if (!combo) throw new ApiError(400, "A selected combo is invalid.", "INVALID_COMBO");

    return {
      comboOffer: combo._id,
      quantity,
      price: Number(combo.offerPrice),
      originalPrice: Number(combo.originalPrice),
      comboItemsSnapshot: combo.items.map((item) => {
        const menu = menuById.get(id(item.menuItem));
        if (!menu) throw new ApiError(409, `${combo.name} contains an unavailable item.`, "MENU_ITEM_UNAVAILABLE");
        return {
          menuItem: menu._id,
          name: menu.name,
          quantity: Number(item.quantity),
          priceSnapshot: Number(item.priceSnapshot),
        };
      }),
    };
  });

  const totalAmount = calculateItemsTotal([...orderItems, ...orderComboItems]);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new ApiError(400, "The order total is invalid.", "INVALID_TOTAL");
  }

  const orderedMenuQuantities = new Map(normalQuantities);
  for (const combo of orderComboItems) {
    for (const item of combo.comboItemsSnapshot) {
      const menuItemId = id(item.menuItem);
      const required = item.quantity * combo.quantity;
      orderedMenuQuantities.set(
        menuItemId,
        (orderedMenuQuantities.get(menuItemId) ?? 0) + required
      );
    }
  }

  const recipes = await RecipeItem.find({
    menuItem: { $in: Array.from(orderedMenuQuantities.keys()) },
  })
    .session(session)
    .lean<RecipeRecord[]>();

  const recipeRequirements: RecipeRequirement[] = recipes.map((recipe) => ({
    menuItemId: id(recipe.menuItem),
    inventoryItemId: id(recipe.inventoryItem),
    requiredQuantity: Number(recipe.requiredQuantity),
  }));

  return {
    orderItems,
    orderComboItems,
    totalAmount,
    requirements: calculateInventoryRequirements(
      orderedMenuQuantities,
      recipeRequirements
    ),
  };
}
