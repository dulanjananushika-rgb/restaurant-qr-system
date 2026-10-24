import { z } from "zod";

import { PAYMENT_STATUSES } from "@/domain/order/types";
import {
  nonNegativeNumber,
  objectIdSchema,
  optionalText,
  positiveInteger,
} from "@/validation/common";

export const purchaseItemSchema = z.object({
  inventoryItem: objectIdSchema,
  quantity: positiveInteger,
  unitCost: nonNegativeNumber,
});

export const createPurchaseSchema = z.object({
  supplier: objectIdSchema,
  invoiceNumber: optionalText(100),
  purchaseDate: z.string().trim().max(40).optional().default(""),
  items: z.array(purchaseItemSchema).min(1, "Please add at least one purchase item."),
  paymentStatus: z.enum(["UNPAID", "PAID", "PARTIALLY_PAID"]).default("UNPAID"),
  note: optionalText(500),
});

export const updatePurchasePaymentSchema = z.object({
  purchaseId: objectIdSchema,
  paymentStatus: z.enum(["UNPAID", "PAID", "PARTIALLY_PAID"]),
});

export const inventoryAdjustmentSchema = z.object({
  inventoryItemId: objectIdSchema,
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().finite(),
  reason: optionalText(500),
});

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

const comboItemInputSchema = z.object({
  menuItem: objectIdSchema,
  quantity: positiveInteger,
});

const optionalDateInput = z
  .union([z.string().trim().max(40), z.null()])
  .optional();

const comboFields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1500).optional().default(""),
  image: z.string().trim().max(2000).optional().default(""),
  items: z.array(comboItemInputSchema).min(1).superRefine((items, context) => {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.menuItem)) {
        context.addIssue({
          code: "custom",
          path: [index, "menuItem"],
          message: "Duplicate menu items are not allowed in one combo.",
        });
      }
      ids.add(item.menuItem);
    });
  }),
  offerPrice: z.coerce.number().finite().positive(),
  active: z.boolean().optional().default(true),
  startDate: optionalDateInput,
  endDate: optionalDateInput,
};

export const createComboOfferSchema = z.object(comboFields);

export const updateComboOfferSchema = z
  .object({
    name: comboFields.name.optional(),
    description: z.string().trim().max(1500).optional(),
    image: z.string().trim().max(2000).optional(),
    items: comboFields.items.optional(),
    offerPrice: comboFields.offerPrice.optional(),
    active: z.boolean().optional(),
    startDate: optionalDateInput,
    endDate: optionalDateInput,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No update data was provided.",
  });

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
});

export const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  price: z.coerce.number().finite().positive(),
  category: objectIdSchema,
  available: z.boolean().optional().default(true),
  image: optionalText(2000),
  description: optionalText(1500),
});

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  unit: z.enum(["kg", "g", "pcs", "L", "ml"]).optional().default("kg"),
  quantity: nonNegativeNumber.optional().default(0),
  minQuantity: nonNegativeNumber.optional().default(0),
});

export const createTableSchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: positiveInteger,
});

export const updateTableSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    capacity: positiveInteger.optional(),
    status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "INACTIVE"]).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one table field is required.",
  });

export const supplierSchema = z.object({
  name: z.string().trim().min(1).max(150),
  contactPerson: optionalText(150),
  phone: optionalText(40),
  email: z.union([z.literal(""), z.email().max(254)]).optional().default(""),
  address: optionalText(500),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
});

export const recipeSchema = z
  .object({
    menuItem: objectIdSchema,
    ingredients: z
      .array(
        z.object({
          inventoryItem: objectIdSchema,
          requiredQuantity: z.coerce.number().finite().positive(),
        })
      )
      .min(1),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.ingredients.forEach((ingredient, index) => {
      if (ids.has(ingredient.inventoryItem)) {
        context.addIssue({
          code: "custom",
          path: ["ingredients", index, "inventoryItem"],
          message: "Duplicate ingredients are not allowed in one recipe.",
        });
      }
      ids.add(ingredient.inventoryItem);
    });
  });

export const recipeQuantitySchema = z.object({
  requiredQuantity: z.coerce.number().finite().positive(),
});

const staffFields = {
  name: z.string().trim().min(1).max(150),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(["ADMIN", "KITCHEN_STAFF", "WAITER", "CASHIER"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
};

export const createStaffSchema = z.object({
  ...staffFields,
  password: z.string().min(6).max(128),
  status: staffFields.status.optional().default("ACTIVE"),
});

export const updateStaffSchema = z.object({
  ...staffFields,
  password: z.union([z.literal(""), z.string().min(6).max(128)]).optional(),
});

export const tableAssignmentSchema = z
  .object({
    tableId: objectIdSchema.optional(),
    tableIds: z.array(objectIdSchema).max(100).optional(),
    waiterId: objectIdSchema.nullable(),
  })
  .superRefine((value, context) => {
    const ids = value.tableIds ?? (value.tableId ? [value.tableId] : []);
    if (ids.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["tableIds"],
        message: "Select at least one table.",
      });
    }
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["tableIds"],
        message: "Duplicate table IDs are not allowed.",
      });
    }
  });

export const waiterWorkStatusSchema = z.object({
  workStatus: z.enum(["ON_DUTY", "ON_BREAK", "OFF_DUTY"]),
});

export const testMessageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(2000),
});
