import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache"; // ← Import කළා

import RecipeItem from "@/models/RecipeItem";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { recipeQuantitySchema } from "@/validation/admin";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { id } = await params;
    const { requiredQuantity } = await parseJsonBody(
      request,
      recipeQuantitySchema
    );

    const recipe = await RecipeItem.findByIdAndUpdate(
      id,
      {
        requiredQuantity,
      },
      { new: true, runValidators: true }
    );

    if (!recipe) {
      return NextResponse.json(
        {
          success: false,
          message: "Recipe mapping not found",
        },
        { status: 404 }
      );
    }

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/recipes");
    // =====================================================

    return NextResponse.json({
      success: true,
      message: "Recipe mapping updated successfully",
      data: recipe,
    });
  } catch (error) {
    return apiErrorResponse(error, "Recipe update failed");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { id } = await params;

    const recipe = await RecipeItem.findByIdAndDelete(id);

    if (!recipe) {
      return NextResponse.json(
        {
          success: false,
          message: "Recipe mapping not found",
        },
        { status: 404 }
      );
    }

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/recipes");
    // =====================================================

    return NextResponse.json({
      success: true,
      message: "Recipe mapping deleted successfully",
    });
  } catch (error) {
    return apiErrorResponse(error, "Recipe deletion failed");
  }
}
