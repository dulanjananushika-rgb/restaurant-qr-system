import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  deleteComboOffer,
  updateComboOffer,
} from "@/application/catalog/combo-offer-service";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireApiUser } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validation";
import { updateComboOfferSchema } from "@/validation/admin";

type RouteContext = { params: Promise<{ id: string }> };

function revalidateComboPages() {
  revalidatePath("/admin/combo-offers");
  revalidatePath("/admin/dashboard");
  revalidatePath("/takeaway");
  revalidatePath("/table/[qrCode]", "page");
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const input = await parseJsonBody(request, updateComboOfferSchema);
    const comboOffer = await updateComboOffer(id, input, auth.user);
    revalidateComboPages();
    return NextResponse.json({
      success: true,
      message: "Combo offer updated successfully.",
      data: comboOffer,
    });
  } catch (error) {
    return apiErrorResponse(error, "Combo offer update failed");
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    await deleteComboOffer(id, auth.user);
    revalidateComboPages();
    return NextResponse.json({
      success: true,
      message: "Combo offer deleted successfully.",
    });
  } catch (error) {
    return apiErrorResponse(error, "Combo offer deletion failed");
  }
}
