import { NextResponse } from "next/server";

import { transitionOrder } from "@/application/orders/transition-order";
import { ORDER_STATUSES } from "@/domain/order/types";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { requireApiUser } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validation";
import Order from "@/models/Order";
import { adminOrderUpdateSchema } from "@/validation/order";

import "@/models/Table";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const input = await parseJsonBody(request, adminOrderUpdateSchema);

    if (input.status) {
      const order = await transitionOrder(
        id,
        input.status,
        "Order status updated by an administrator.",
        auth.user,
        { channel: "ADMIN", allowedStatuses: ORDER_STATUSES }
      );
      return NextResponse.json({
        success: true,
        message: "Order status updated successfully",
        data: order,
      });
    }

    const order = await Order.findById(id).populate("table").lean();
    if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
    if (input.paymentStatus !== order.paymentStatus) {
      throw new ApiError(
        409,
        "Payment status is controlled by the cashier/payment workflow so that a matching payment record is always created.",
        "PAYMENT_WORKFLOW_REQUIRED"
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment status is already up to date",
      data: order,
    });
  } catch (error) {
    return apiErrorResponse(error, "Admin order update failed");
  }
}
