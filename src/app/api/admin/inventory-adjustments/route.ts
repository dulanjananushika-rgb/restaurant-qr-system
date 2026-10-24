import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { adjustStock } from "@/application/inventory/adjust-stock";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireApiUser } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validation";
import { connectDB } from "@/lib/mongodb";
import StockMovement from "@/models/StockMovement";
import { inventoryAdjustmentSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();
    const movements = await StockMovement.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("inventoryItem")
      .lean();
    return NextResponse.json({ success: true, data: movements });
  } catch (error) {
    return apiErrorResponse(error, "Stock movement list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    const input = await parseJsonBody(request, inventoryAdjustmentSchema);
    const data = await adjustStock(input, auth.user);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory-adjustments");
    return NextResponse.json(
      { success: true, message: "Stock adjusted successfully", data },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Stock adjustment failed");
  }
}
