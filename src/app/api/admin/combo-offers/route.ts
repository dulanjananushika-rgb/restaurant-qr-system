import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  createComboOffer,
  listComboOffers,
} from "@/application/catalog/combo-offer-service";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireApiUser } from "@/lib/api/auth";
import { parseJsonBody } from "@/lib/api/validation";
import { createComboOfferSchema } from "@/validation/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function revalidateComboPages() {
  revalidatePath("/admin/combo-offers");
  revalidatePath("/admin/dashboard");
  revalidatePath("/takeaway");
  revalidatePath("/table/[qrCode]", "page");
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    const comboOffers = await listComboOffers();
    return NextResponse.json(
      { success: true, data: comboOffers },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiErrorResponse(error, "Combo offer list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    const input = await parseJsonBody(request, createComboOfferSchema);
    const comboOffer = await createComboOffer(input, auth.user);
    revalidateComboPages();
    return NextResponse.json(
      {
        success: true,
        message: "Combo offer created successfully.",
        data: comboOffer,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Combo offer creation failed");
  }
}
