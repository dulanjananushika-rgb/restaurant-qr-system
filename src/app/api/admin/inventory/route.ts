import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache"; // ← Import කළා
import InventoryItem from "@/models/InventoryItem";

export async function GET() {
  try {
    await connectDB();

    const items = await InventoryItem.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Inventory GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load inventory items",
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

    const item = await InventoryItem.create({
      name,
      unit: unit || "kg",
      quantity: Number(quantity) || 0,
      minQuantity: Number(minQuantity) || 0,
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
    console.error("Inventory POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create inventory item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}