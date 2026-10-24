import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache"; // ← Import කළා
import InventoryItem from "@/models/InventoryItem";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { inventoryItemSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const items = await InventoryItem.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    return apiErrorResponse(error, "Inventory list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { name, unit, quantity, minQuantity } = await parseJsonBody(
      request,
      inventoryItemSchema
    );

    const item = await InventoryItem.create({
      name,
      unit,
      quantity,
      minQuantity,
    });

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/inventory");
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        message: "Inventory item created successfully",
        data: item,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Inventory item creation failed");
  }
}
