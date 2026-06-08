import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import RecipeItem from "@/models/RecipeItem";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const { requiredQuantity } = body;

    if (!requiredQuantity || Number(requiredQuantity) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Required quantity must be greater than 0",
        },
        { status: 400 }
      );
    }

    const recipe = await RecipeItem.findByIdAndUpdate(
      id,
      {
        requiredQuantity: Number(requiredQuantity),
      },
      { new: true }
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

    return NextResponse.json({
      success: true,
      message: "Recipe mapping updated successfully",
      data: recipe,
    });
  } catch (error) {
    console.error("Recipe PATCH API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update recipe mapping",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
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

    return NextResponse.json({
      success: true,
      message: "Recipe mapping deleted successfully",
    });
  } catch (error) {
    console.error("Recipe DELETE API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete recipe mapping",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}