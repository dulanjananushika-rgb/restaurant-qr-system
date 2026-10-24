import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { completePublicPayment } from "@/application/payments/complete-public-payment";
import { apiErrorResponse } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/validation";
import { publicPaymentSchema } from "@/validation/order";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimitResponse = enforceRateLimit(
    request,
    "public-payment",
    10,
    60_000
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const input = await parseJsonBody(request, publicPaymentSchema);
    const accessToken =
      request.cookies.get(`order_access_${input.orderId}`)?.value ?? "";
    const data = await completePublicPayment(
      input.orderId,
      accessToken,
      input.note
    );

    revalidatePath(`/payment/${input.orderId}`);
    revalidatePath(`/payment/${input.orderId}/success`);
    revalidatePath(`/order/${input.orderId}/receipt`);
    revalidatePath("/cashier/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/takeaway");
    revalidatePath("/table/[qrCode]", "page");

    return NextResponse.json(
      {
        success: true,
        message: data.alreadyPaid
          ? "This order is already paid."
          : "Payment completed successfully.",
        data,
      },
      { status: data.alreadyPaid ? 200 : 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Public payment failed");
  }
}
