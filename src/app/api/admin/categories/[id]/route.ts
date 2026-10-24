import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Category from "@/models/Category";
import MenuItem from "@/models/MenuItem";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { categorySchema } from "@/validation/admin";

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
    const { name, description } = await parseJsonBody(request, categorySchema);

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name,
        description,
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
    return apiErrorResponse(error, "Category update failed");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
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
    return apiErrorResponse(error, "Category deletion failed");
  }
}
