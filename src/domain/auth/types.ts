export const USER_ROLES = [
  "ADMIN",
  "KITCHEN_STAFF",
  "WAITER",
  "CASHIER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const WORK_STATUSES = [
  "ON_DUTY",
  "ON_BREAK",
  "OFF_DUTY",
  "ON_LEAVE",
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type ActiveAuthUser = AuthUser & {
  status: "ACTIVE";
  workStatus?: WorkStatus;
};
