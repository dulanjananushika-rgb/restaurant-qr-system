import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createPurchase,
  updatePurchasePayment,
} from "@/application/inventory/purchase-service";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { connectDB } from "@/lib/mongodb";
import Purchase from "@/models/Purchase";
import {
  createPurchaseSchema,
  updatePurchasePaymentSchema,
} from "@/validation/admin";

export async function GET(request: Request) {
  const auth = await requireApiUser(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const purchases = await Purchase.find()
      .sort({ createdAt: -1 })
      .populate("supplier")
      .populate("items.inventoryItem")
      .lean();
    return NextResponse.json({ success: true, data: purchases });
  } catch (error) {
    return apiErrorResponse(error, "Purchase list failed");
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const input = await parseJsonBody(request, createPurchaseSchema);
    const data = await createPurchase(input);
    revalidatePath("/admin/purchases");
    revalidatePath("/admin/inventory");
    return NextResponse.json({
      success: true,
      message: "Purchase created successfully",
      data,
    });
  } catch (error) {
    return apiErrorResponse(error, "Purchase creation failed");
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser(request, ["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const input = await parseJsonBody(request, updatePurchasePaymentSchema);
    const data = await updatePurchasePayment(input);
    revalidatePath("/admin/purchases");
    return NextResponse.json({
      success: true,
      message: "Payment status updated successfully",
      data,
    });
  } catch (error) {
    return apiErrorResponse(error, "Purchase payment update failed");
  }
}
