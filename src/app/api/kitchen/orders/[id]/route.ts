import { NextRequest, NextResponse } from "next/server";

import { transitionOrder } from "@/application/orders/transition-order";
import { KITCHEN_STATUSES } from "@/domain/order/status-machine";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { kitchenTransitionSchema } from "@/validation/order";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiUser(request, ["KITCHEN_STAFF", "ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, kitchenTransitionSchema);
    const data = await transitionOrder(id, input.status, input.note, auth.user, {
      channel: "KITCHEN",
      allowedStatuses: KITCHEN_STATUSES,
    });
    return NextResponse.json({
      success: true,
      message: "Kitchen order updated successfully",
      data: { orderId: id, status: data.status },
    });
  } catch (error) {
    return apiErrorResponse(error, "Kitchen order update failed");
  }
}
