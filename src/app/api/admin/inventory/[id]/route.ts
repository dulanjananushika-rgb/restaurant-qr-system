import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

import InventoryItem from "@/models/InventoryItem";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const { name, unit, quantity, minQuantity } = body;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Item name is required",
        },
        { status: 400 }
      );
    }

    const updatedItem = await InventoryItem.findByIdAndUpdate(
      id,
      {
        name,
        unit: unit || "kg",
        quantity: Number(quantity) || 0,
        minQuantity: Number(minQuantity) || 0,
      },
      { new: true }
    );

    if (!updatedItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Inventory item not found",
        },
        { status: 404 }
      );
    }

    revalidatePath("/admin/inventory");

    return NextResponse.json({
      success: true,
      message: "Inventory item updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Inventory PATCH API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update inventory item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ==================== DELETE METHOD ====================
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;

    const item = await InventoryItem.findById(id);

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          message: "Inventory item not found",
        },
        { status: 404 }
      );
    }

    // Stock තියෙනවා නම් delete කරන්න එපා
    if (item.quantity > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete. This item still has ${item.quantity} ${item.unit} in stock.`,
        },
        { status: 400 }
      );
    }

    await InventoryItem.findByIdAndDelete(id);

    revalidatePath("/admin/inventory");

    return NextResponse.json({
      success: true,
      message: "Inventory item deleted successfully",
    });
  } catch (error) {
    console.error("Inventory DELETE API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete inventory item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}