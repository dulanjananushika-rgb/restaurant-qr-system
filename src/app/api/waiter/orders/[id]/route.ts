import { NextResponse } from "next/server";

import { updateWaiterOrder } from "@/application/orders/waiter-order";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireApiUser } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validation";
import { deliveryTransitionSchema } from "@/validation/order";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireApiUser(request, ["WAITER"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const input = await parseJsonBody(request, deliveryTransitionSchema);
    const result = await updateWaiterOrder(
      id,
      input.status,
      input.note ?? "",
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.order,
    });
  } catch (error) {
    return apiErrorResponse(error, "Waiter order update failed");
  }
}
