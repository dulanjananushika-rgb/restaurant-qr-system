import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache";

import InventoryItem from "@/models/InventoryItem";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { inventoryItemSchema } from "@/validation/admin";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { id } = await params;
    const { name, unit, quantity, minQuantity } = await parseJsonBody(
      request,
      inventoryItemSchema
    );

    const updatedItem = await InventoryItem.findByIdAndUpdate(
      id,
      {
        name,
        unit,
        quantity,
        minQuantity,
      },
      { new: true, runValidators: true }
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
    return apiErrorResponse(error, "Inventory item update failed");
  }
}

// ==================== DELETE METHOD ====================
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
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
    return apiErrorResponse(error, "Inventory item deletion failed");
  }
}
