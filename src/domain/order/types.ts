export const ORDER_TYPES = ["DINE_IN", "TAKE_AWAY", "ONLINE"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_TYPES = ["PAY_NOW", "PAY_LATER"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = ["CASH", "CARD", "ONLINE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "UNPAID",
  "PENDING",
  "PAID",
  "FAILED",
  "PARTIALLY_PAID",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type MenuQuantity = {
  menuItemId: string;
  quantity: number;
};

export type RecipeRequirement = {
  menuItemId: string;
  inventoryItemId: string;
  requiredQuantity: number;
};

export type PricedItem = {
  price: number;
  quantity: number;
};
