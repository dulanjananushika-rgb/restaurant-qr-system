import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache"; // ← Import කළා

import InventoryItem from "@/models/InventoryItem";
import StockMovement from "@/models/StockMovement";

type AdjustmentType = "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";

export async function GET() {
  try {
    await connectDB();

    const movements = await StockMovement.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("inventoryItem")
      .lean();

    return NextResponse.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error("Stock movements GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load stock movements",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const {
      inventoryItemId,
      type,
      quantity,
      reason = "",
    } = body as {
      inventoryItemId: string;
      type: AdjustmentType;
      quantity: number;
      reason?: string;
    };

    if (!inventoryItemId) {
      return NextResponse.json(
        {
          success: false,
          message: "Inventory item is required",
        },
        { status: 400 }
      );
    }

    if (!type || !["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid adjustment type is required",
        },
        { status: 400 }
      );
    }

    if (quantity === undefined || Number.isNaN(Number(quantity))) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid quantity is required",
        },
        { status: 400 }
      );
    }

    const inventoryItem = await InventoryItem.findById(inventoryItemId);

    if (!inventoryItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Inventory item not found",
        },
        { status: 404 }
      );
    }

    const previousQuantity = Number(inventoryItem.quantity);
    const adjustmentQuantity = Number(quantity);

    let newQuantity = previousQuantity;

    if (type === "STOCK_IN") {
      if (adjustmentQuantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Stock in quantity must be greater than 0",
          },
          { status: 400 }
        );
      }

      newQuantity = previousQuantity + adjustmentQuantity;
    }

    if (type === "STOCK_OUT") {
      if (adjustmentQuantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Stock out quantity must be greater than 0",
          },
          { status: 400 }
        );
      }

      if (previousQuantity < adjustmentQuantity) {
        return NextResponse.json(
          {
            success: false,
            message: `Not enough stock. Available: ${previousQuantity} ${inventoryItem.unit}`,
          },
          { status: 400 }
        );
      }

      newQuantity = previousQuantity - adjustmentQuantity;
    }

    if (type === "ADJUSTMENT") {
      if (adjustmentQuantity < 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Adjusted quantity cannot be negative",
          },
          { status: 400 }
        );
      }

      newQuantity = adjustmentQuantity;
    }

    inventoryItem.quantity = newQuantity;
    await inventoryItem.save();

    const movementQuantity =
      type === "ADJUSTMENT"
        ? newQuantity - previousQuantity
        : type === "STOCK_OUT"
        ? -adjustmentQuantity
        : adjustmentQuantity;

    const movement = await StockMovement.create({
      inventoryItem: inventoryItem._id,
      type,
      quantity: movementQuantity,
      previousQuantity,
      newQuantity,
      reason,
      referenceType: "MANUAL",
      referenceId: null,
    });

    await createAuditLog({
      action: "STOCK_ADJUSTED",
      module: "INVENTORY",
      description: `${inventoryItem.name} stock changed from ${previousQuantity} ${inventoryItem.unit} to ${newQuantity} ${inventoryItem.unit}. Type: ${type}.`,
    });

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory-adjustments");
    // =====================================================

    const populatedMovement = await StockMovement.findById(movement._id)
      .populate("inventoryItem")
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: "Stock adjusted successfully",
        data: {
          inventoryItem,
          movement: populatedMovement,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Stock adjustment POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to adjust stock",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}