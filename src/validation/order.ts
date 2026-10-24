import { z } from "zod";

import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
} from "@/domain/order/types";
import {
  DELIVERY_STATUSES,
  KITCHEN_STATUSES,
} from "@/domain/order/status-machine";
import { objectIdSchema, optionalText, positiveInteger } from "@/validation/common";

export const orderItemSchema = z.object({
  menuItemId: objectIdSchema,
  quantity: positiveInteger,
});

export const comboOrderItemSchema = z.object({
  comboOfferId: objectIdSchema,
  quantity: positiveInteger,
});

export const createOrderSchema = z
  .object({
    tableId: objectIdSchema.optional(),
    orderType: z.enum(["DINE_IN", "TAKE_AWAY"]).default("DINE_IN"),
    items: z.array(orderItemSchema).default([]),
    comboItems: z.array(comboOrderItemSchema).default([]),
    paymentType: z.enum(PAYMENT_TYPES),
    customerName: optionalText(100),
    customerPhone: optionalText(30),
  })
  .superRefine((value, context) => {
    if (value.orderType === "DINE_IN" && !value.tableId) {
      context.addIssue({
        code: "custom",
        path: ["tableId"],
        message: "A table is required for dine-in orders.",
      });
    }
    if (value.items.length === 0 && value.comboItems.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Please add at least one item to the order.",
      });
    }
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const publicOrderUpdateSchema = z
  .object({
    editToken: z.string().trim().min(32).max(128),
    customerName: optionalText(100),
    customerPhone: optionalText(30),
    items: z.array(orderItemSchema).optional(),
    comboItems: z.array(comboOrderItemSchema).optional(),
    cancel: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    if (
      !value.cancel &&
      (!value.items || value.items.length === 0) &&
      (!value.comboItems || value.comboItems.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Please add at least one item.",
      });
    }
  });

export const publicPaymentSchema = z.object({
  orderId: objectIdSchema,
  method: z.literal("ONLINE").optional().default("ONLINE"),
  note: optionalText(500),
});

export const cashierPaymentSchema = z
  .object({
    orderId: objectIdSchema.optional(),
    diningSessionId: objectIdSchema.optional(),
    method: z.enum(PAYMENT_METHODS),
    note: optionalText(500),
  })
  .refine((value) => Boolean(value.orderId) !== Boolean(value.diningSessionId), {
    message: "Provide either an order ID or a dining session ID.",
    path: ["orderId"],
  });

export const adminOrderUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  })
  .refine(
    (value) => Boolean(value.status) !== Boolean(value.paymentStatus),
    { message: "Update either order status or payment status, but not both." }
  );

export const kitchenTransitionSchema = z.object({
  status: z.enum(KITCHEN_STATUSES),
  note: optionalText(500),
});

export const deliveryTransitionSchema = z.object({
  status: z.enum(DELIVERY_STATUSES),
  note: optionalText(500),
});

export const counterTakeawaySchema = z
  .object({
    customerName: z.string().trim().min(1).max(100),
    customerPhone: optionalText(30),
    paymentType: z.enum(PAYMENT_TYPES),
    paymentMethod: z.enum(["CASH", "CARD"]).optional(),
    paymentNote: optionalText(500),
    items: z.array(orderItemSchema).default([]),
    comboItems: z.array(comboOrderItemSchema).default([]),
  })
  .superRefine((value, context) => {
    if (value.items.length === 0 && value.comboItems.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Please add at least one item.",
      });
    }
    if (value.paymentType === "PAY_NOW" && !value.paymentMethod) {
      context.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "A payment method is required for Pay Now.",
      });
    }
  });

export const collectTakeawaySchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD"]).optional(),
  note: optionalText(300),
});
