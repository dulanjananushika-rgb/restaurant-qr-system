import type { OrderStatus } from "@/domain/order/types";

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const KITCHEN_STATUSES = ["ACCEPTED", "PREPARING", "READY"] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export const DELIVERY_STATUSES = ["PICKED_UP", "DELIVERED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export function canTransitionOrder(
  current: OrderStatus,
  next: OrderStatus
): boolean {
  return TRANSITIONS[current].includes(next);
}

export function getAllowedOrderTransitions(
  status: OrderStatus
): readonly OrderStatus[] {
  return TRANSITIONS[status];
}
