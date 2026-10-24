import { NextRequest, NextResponse } from "next/server";

import { transitionOrder } from "@/application/orders/transition-order";
import { DELIVERY_STATUSES } from "@/domain/order/status-machine";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { deliveryTransitionSchema } from "@/validation/order";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiUser(request, ["CASHIER", "ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, deliveryTransitionSchema);
    const data = await transitionOrder(id, input.status, input.note, auth.user, {
      channel: "CASHIER_DELIVERY",
      allowedStatuses: DELIVERY_STATUSES,
    });
    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
      data,
    });
  } catch (error) {
    return apiErrorResponse(error, "Cashier order update failed");
  }
}
