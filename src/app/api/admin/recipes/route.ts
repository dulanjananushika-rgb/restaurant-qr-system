import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache"; // ← Import කළා

import RecipeItem from "@/models/RecipeItem";
import MenuItem from "@/models/MenuItem";
import InventoryItem from "@/models/InventoryItem";

type IngredientInput = {
  inventoryItem: string;
  requiredQuantity: number;
};

export async function GET() {
  try {
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
    console.error("Recipes GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load recipe mappings",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    const { menuItem, ingredients } = body as {
      menuItem: string;
      ingredients: IngredientInput[];
    };

    if (!menuItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Menu item is required",
        },
        { status: 400 }
      );
    }

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add at least one ingredient",
        },
        { status: 400 }
      );
    }

    const menuItemExists = await MenuItem.findById(menuItem);

    if (!menuItemExists) {
      return NextResponse.json(
        {
          success: false,
          message: "Selected menu item not found",
        },
        { status: 404 }
      );
    }

    const cleanedIngredients = ingredients
      .filter(
        (item) =>
          item.inventoryItem &&
          Number(item.requiredQuantity) > 0
      )
      .map((item) => ({
        inventoryItem: item.inventoryItem,
        requiredQuantity: Number(item.requiredQuantity),
      }));

    if (cleanedIngredients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Please add valid ingredients and quantities",
        },
        { status: 400 }
      );
    }

    const duplicateCheck = new Set<string>();

    for (const item of cleanedIngredients) {
      if (duplicateCheck.has(item.inventoryItem)) {
        return NextResponse.json(
          {
            success: false,
            message: "Duplicate ingredients are not allowed in one recipe",
          },
          { status: 400 }
        );
      }

      duplicateCheck.add(item.inventoryItem);
    }

    const inventoryIds = cleanedIngredients.map((item) => item.inventoryItem);

    const inventoryCount = await InventoryItem.countDocuments({
      _id: { $in: inventoryIds },
    });

    if (inventoryCount !== inventoryIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "Some inventory ingredients are invalid",
        },
        { status: 400 }
      );
    }

    await RecipeItem.deleteMany({ menuItem });

    const recipeDocs = cleanedIngredients.map((item) => ({
      menuItem,
      inventoryItem: item.inventoryItem,
      requiredQuantity: item.requiredQuantity,
    }));

    const savedRecipes = await RecipeItem.insertMany(recipeDocs);

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
    console.error("Recipes POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save recipe",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}