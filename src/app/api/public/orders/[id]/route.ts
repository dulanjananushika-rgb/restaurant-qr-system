import mongoose from "mongoose";
import { NextResponse } from "next/server";

import {
  getCustomerOrder,
  updateCustomerOrder,
} from "@/application/orders/update-order";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/validation";
import { publicOrderUpdateSchema } from "@/validation/order";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const token = request.headers.get("x-order-token")?.trim() ?? "";
    const data = await getCustomerOrder(id, token);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error, "Public order lookup failed");
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const rateLimitResponse = enforceRateLimit(
    request,
    "public-order-update",
    30,
    60_000
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, "Invalid order ID.", "INVALID_ORDER_ID");
    }
    const input = await parseJsonBody(request, publicOrderUpdateSchema);
    const data = await updateCustomerOrder(id, input);
    return NextResponse.json({
      success: true,
      message: input.cancel
        ? "Order cancelled successfully"
        : "Order updated successfully",
      data,
    });
  } catch (error) {
    return apiErrorResponse(error, "Public order update failed");
  }
}
