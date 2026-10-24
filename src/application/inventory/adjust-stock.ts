import type { z } from "zod";

import type { ActiveAuthUser } from "@/domain/auth/types";
import { createAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api/errors";
import { runInTransaction } from "@/lib/db/transaction";
import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";
import type { inventoryAdjustmentSchema } from "@/validation/admin";

type AdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;

export async function adjustStock(input: AdjustmentInput, user: ActiveAuthUser) {
  return runInTransaction(async (session) => {
    const inventoryItem = await InventoryItem.findById(input.inventoryItemId).session(
      session
    );
    if (!inventoryItem) {
      throw new ApiError(404, "Inventory item not found.", "INVENTORY_NOT_FOUND");
    }

    const previousQuantity = Number(inventoryItem.quantity);
    let newQuantity: number;
    if (input.type === "STOCK_IN") {
      if (input.quantity <= 0) {
        throw new ApiError(400, "Stock in quantity must be greater than 0.");
      }
      newQuantity = previousQuantity + input.quantity;
    } else if (input.type === "STOCK_OUT") {
      if (input.quantity <= 0) {
        throw new ApiError(400, "Stock out quantity must be greater than 0.");
      }
      if (previousQuantity < input.quantity) {
        throw new ApiError(
          409,
          `Not enough stock. Available: ${previousQuantity} ${inventoryItem.unit}.`,
          "INSUFFICIENT_STOCK"
        );
      }
      newQuantity = previousQuantity - input.quantity;
    } else {
      if (input.quantity < 0) {
        throw new ApiError(400, "Adjusted quantity cannot be negative.");
      }
      newQuantity = input.quantity;
    }

    inventoryItem.quantity = newQuantity;
    await inventoryItem.save({ session });
    const movementQuantity = newQuantity - previousQuantity;
    const [movement] = await StockMovement.create(
      [
        {
          inventoryItem: inventoryItem._id,
          type: input.type,
          quantity: movementQuantity,
          previousQuantity,
          newQuantity,
          reason: input.reason,
          referenceType: "MANUAL",
          referenceId: null,
        },
      ],
      { session }
    );

    await createAuditLog(
      {
        action: "STOCK_ADJUSTED",
        module: "INVENTORY",
        description: `${inventoryItem.name} stock changed from ${previousQuantity} ${inventoryItem.unit} to ${newQuantity} ${inventoryItem.unit}. Type: ${input.type}.`,
        performedBy: user.email,
        metadata: {
          inventoryItemId: inventoryItem._id.toString(),
          previousQuantity,
          newQuantity,
          movementQuantity,
        },
      },
      { session, failClosed: true }
    );

    const populatedMovement = await StockMovement.findById(movement._id)
      .populate("inventoryItem")
      .session(session)
      .lean();
    return { inventoryItem: inventoryItem.toObject(), movement: populatedMovement };
  });
}
