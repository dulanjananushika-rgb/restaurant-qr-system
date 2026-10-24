import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { settlePayment } from "@/application/payments/settle-payment";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { cashierPaymentSchema } from "@/validation/order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, ["CASHIER", "ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const input = await parseJsonBody(request, cashierPaymentSchema);
    const data = await settlePayment(input, auth.user);

    revalidatePath("/cashier/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/reports");
    if (data.orderId) revalidatePath(`/cashier/receipt/${data.orderId}`);
    if (data.diningSessionId) {
      revalidatePath(`/cashier/receipt/session/${data.diningSessionId}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: data.diningSessionId
          ? "Combined table bill settled successfully."
          : "Order payment settled successfully.",
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Cashier payment failed");
  }
}
