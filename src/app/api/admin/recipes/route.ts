import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache"; // ← Import කළා

import RecipeItem from "@/models/RecipeItem";
import MenuItem from "@/models/MenuItem";
import InventoryItem from "@/models/InventoryItem";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { runInTransaction } from "@/lib/db/transaction";
import { recipeSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const recipes = await RecipeItem.find()
      .sort({ createdAt: -1 })
      .populate("menuItem")
      .populate("inventoryItem")
      .lean();

    const menuItems = await MenuItem.find().sort({ name: 1 }).lean();
    const inventoryItems = await InventoryItem.find().sort({ name: 1 }).lean();

    return NextResponse.json({
      success: true,
      data: {
        recipes,
        menuItems,
        inventoryItems,
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Recipe list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { menuItem, ingredients } = await parseJsonBody(request, recipeSchema);

    const savedRecipes = await runInTransaction(async (session) => {
      const [menuItemExists, inventoryCount] = await Promise.all([
        MenuItem.exists({ _id: menuItem }).session(session),
        InventoryItem.countDocuments({
          _id: { $in: ingredients.map((item) => item.inventoryItem) },
        }).session(session),
      ]);
      if (!menuItemExists) {
        throw new ApiError(404, "Selected menu item not found.", "MENU_ITEM_NOT_FOUND");
      }
      if (inventoryCount !== ingredients.length) {
        throw new ApiError(
          400,
          "Some inventory ingredients are invalid.",
          "INVALID_INGREDIENTS"
        );
      }

      await RecipeItem.deleteMany({ menuItem }, { session });
      return RecipeItem.insertMany(
        ingredients.map((ingredient) => ({ menuItem, ...ingredient })),
        { session }
      );
    });

    // ==================== IMPORTANT FIX ====================
    revalidatePath("/admin/recipes");
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        message: "Recipe saved successfully",
        data: savedRecipes,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Recipe save failed");
  }
}
