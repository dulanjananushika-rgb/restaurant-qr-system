export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "PARTIALLY_PAID"
  | "REFUNDED";

export type OrderType = "DINE_IN" | "TAKE_AWAY";

export type UserRole = "ADMIN" | "KITCHEN_STAFF" | "WAITER" | "CASHIER";