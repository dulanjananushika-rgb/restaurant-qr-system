import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";

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

    const { name, description } = body as {
      name?: string;
      description?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Category name is required",
        },
        { status: 400 }
      );
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        description: description?.trim() || "",
      },
      { new: true }
    );

    if (!updatedCategory) {
      return NextResponse.json(
        {
          success: false,
          message: "Category not found",
        },
        { status: 404 }
      );
    }

    await createAuditLog({
      action: "CATEGORY_UPDATED",
      module: "CATEGORIES",
      description: `Category "${updatedCategory.name}" updated.`,
    });

    return NextResponse.json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Category PATCH API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update category",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;

    const category = await Category.findById(id);

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Category not found",
        },
        { status: 404 }
      );
    }

    const usedMenuItems = await MenuItem.countDocuments({
      category: category._id,
    });

    if (usedMenuItems > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete this category because it is used by menu items. Please change or delete those menu items first.",
        },
        { status: 400 }
      );
    }

    await Category.findByIdAndDelete(id);

    await createAuditLog({
      action: "CATEGORY_DELETED",
      module: "CATEGORIES",
      description: `Category "${category.name}" deleted.`,
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Category DELETE API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete category",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}