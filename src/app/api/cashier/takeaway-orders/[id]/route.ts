import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { collectTakeaway } from "@/application/orders/collect-takeaway";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { collectTakeawaySchema } from "@/validation/order";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiUser(request, ["CASHIER", "ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, collectTakeawaySchema);
    const data = await collectTakeaway(id, input, auth.user);
    revalidatePath("/cashier/takeaway");
    revalidatePath("/cashier/orders");
    revalidatePath("/admin/dashboard");
    revalidatePath(`/cashier/receipt/${id}`);

    return NextResponse.json({
      success: true,
      message: data.alreadyPaid
        ? "Takeaway order handed over successfully."
        : "Payment completed and takeaway order handed over successfully.",
      data,
    });
  } catch (error) {
    return apiErrorResponse(error, "Takeaway collection failed");
  }
}
