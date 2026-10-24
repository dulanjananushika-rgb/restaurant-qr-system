import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { createCounterTakeaway } from "@/application/orders/create-counter-takeaway";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { counterTakeawaySchema } from "@/validation/order";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, ["CASHIER", "ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const input = await parseJsonBody(request, counterTakeawaySchema);
    const data = await createCounterTakeaway(input, auth.user);
    revalidatePath("/cashier/takeaway");
    revalidatePath("/cashier/orders");
    revalidatePath("/kitchen/orders");
    revalidatePath("/admin/dashboard");

    return NextResponse.json(
      {
        success: true,
        message:
          input.paymentType === "PAY_NOW"
            ? "Takeaway order created and payment completed."
            : "Takeaway order created. Payment is due at pickup.",
        data,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Cashier takeaway creation failed");
  }
}
