import { NextResponse } from "next/server";

import { placeOrder } from "@/application/orders/place-order";
import { apiErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/validation";
import { createOrderSchema } from "@/validation/order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimitResponse = enforceRateLimit(
    request,
    "public-order",
    20,
    60_000
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const input = await parseJsonBody(request, createOrderSchema);
    const data = await placeOrder(input);

    const response = NextResponse.json(
      { success: true, message: "Order placed successfully.", data },
      { status: 201 }
    );
    response.cookies.set(`order_access_${data.orderId}`, data.editToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error, "Public order creation failed");
  }
}
