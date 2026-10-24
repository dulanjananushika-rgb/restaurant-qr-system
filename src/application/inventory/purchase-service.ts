import { type Types } from "mongoose";

import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import InventoryItem from "@/models/InventoryItem";
import Purchase from "@/models/Purchase";
import StockMovement from "@/models/StockMovement";
import Supplier from "@/models/Supplier";
import type {
  createPurchaseSchema,
  updatePurchasePaymentSchema,
} from "@/validation/admin";
import type { z } from "zod";

type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
type UpdatePurchasePaymentInput = z.infer<typeof updatePurchasePaymentSchema>;

type SupplierRecord = {
  _id: Types.ObjectId;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

type InventoryRecord = {
  _id: Types.ObjectId;
  name: string;
  quantity: number;
};

export async function createPurchase(input: CreatePurchaseInput) {
  return runInTransaction(async (session) => {
    const supplier = await Supplier.findById(input.supplier)
      .session(session)
      .lean<SupplierRecord>();
    if (!supplier) throw new ApiError(404, "Supplier not found.", "SUPPLIER_NOT_FOUND");
    if (supplier.status !== "ACTIVE") {
      throw new ApiError(409, "Selected supplier is inactive.", "SUPPLIER_INACTIVE");
    }

    const uniqueInventoryIds = Array.from(
      new Set(input.items.map((item) => item.inventoryItem))
    );
    const inventory = await InventoryItem.find({
      _id: { $in: uniqueInventoryIds },
    })
      .session(session)
      .lean<InventoryRecord[]>();
    if (inventory.length !== uniqueInventoryIds.length) {
      throw new ApiError(400, "Some inventory items are invalid.", "INVALID_INVENTORY_ITEMS");
    }

    const inventoryById = new Map(
      inventory.map((item) => [item._id.toString(), item])
    );
    const purchaseItems = input.items.map((item) => {
      const inventoryItem = inventoryById.get(item.inventoryItem);
      if (!inventoryItem) {
        throw new ApiError(400, "An inventory item is invalid.", "INVALID_INVENTORY_ITEM");
      }
      return {
        inventoryItem: inventoryItem._id,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: Number((item.quantity * item.unitCost).toFixed(2)),
      };
    });

    const totalAmount = Number(
      purchaseItems.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)
    );
    const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : new Date();
    if (Number.isNaN(purchaseDate.getTime())) {
      throw new ApiError(400, "Purchase date is invalid.", "INVALID_PURCHASE_DATE");
    }

    const [purchase] = await Purchase.create(
      [
        {
          supplier: supplier._id,
          invoiceNumber: input.invoiceNumber,
          purchaseDate,
          items: purchaseItems,
          totalAmount,
          paymentStatus: input.paymentStatus,
          note: input.note,
        },
      ],
      { session }
    );

    const quantityByInventory = new Map<string, number>();
    for (const item of purchaseItems) {
      const id = item.inventoryItem.toString();
      quantityByInventory.set(id, (quantityByInventory.get(id) ?? 0) + item.quantity);
    }

    const stockUpdate = await InventoryItem.bulkWrite(
      Array.from(quantityByInventory, ([inventoryId, quantity]) => ({
        updateOne: {
          filter: { _id: inventoryId },
          update: { $inc: { quantity } },
        },
      })),
      { session, ordered: true }
    );
    if (stockUpdate.modifiedCount !== quantityByInventory.size) {
      throw new ApiError(409, "Inventory changed while saving the purchase.", "INVENTORY_CONFLICT");
    }

    await StockMovement.insertMany(
      Array.from(quantityByInventory, ([inventoryId, quantity]) => {
        const item = inventoryById.get(inventoryId);
        if (!item) throw new ApiError(500, "Inventory snapshot is missing.");
        return {
          inventoryItem: item._id,
          type: "STOCK_IN",
          quantity,
          previousQuantity: Number(item.quantity),
          newQuantity: Number(item.quantity) + quantity,
          reason: `Stock purchased from ${supplier.name}`,
          referenceType: "PURCHASE",
          referenceId: purchase._id,
        };
      }),
      { session }
    );

    await createAuditLog(
      {
        action: "PURCHASE_CREATED",
        module: "PURCHASES",
        description: `Purchase created from ${supplier.name}. Total: Rs. ${totalAmount}`,
        metadata: { purchaseId: purchase._id.toString(), totalAmount },
      },
      { session, failClosed: true }
    );

    return Purchase.findById(purchase._id)
      .populate("supplier")
      .populate("items.inventoryItem")
      .session(session)
      .lean();
  });
}

export async function updatePurchasePayment(input: UpdatePurchasePaymentInput) {
  return runInTransaction(async (session) => {
    const purchase = await Purchase.findByIdAndUpdate(
      input.purchaseId,
      { $set: { paymentStatus: input.paymentStatus } },
      { new: true, runValidators: true, session }
    );
    if (!purchase) throw new ApiError(404, "Purchase not found.", "PURCHASE_NOT_FOUND");

    await createAuditLog(
      {
        action: "PURCHASE_PAYMENT_UPDATED",
        module: "PURCHASES",
        description: `Payment status changed to ${input.paymentStatus} for purchase #${purchase._id
          .toString()
          .slice(-6)}`,
        metadata: { purchaseId: purchase._id.toString(), paymentStatus: input.paymentStatus },
      },
      { session, failClosed: true }
    );

    return Purchase.findById(purchase._id)
      .populate("supplier")
      .populate("items.inventoryItem")
      .session(session)
      .lean();
  });
}
