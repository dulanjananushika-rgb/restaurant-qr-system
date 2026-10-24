import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { revalidatePath } from "next/cache";
import Category from "@/models/Category";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { categorySchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const categories = await Category.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    return apiErrorResponse(error, "Category list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { name, description } = await parseJsonBody(request, categorySchema);

    const category = await Category.create({
      name,
      description: description || "",
    });

    // Revalidate paths after creating new category
    revalidatePath("/admin/categories");
    revalidatePath("/admin/menu");

    return NextResponse.json(
      {
        success: true,
        message: "Category created successfully",
        data: category,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Category creation failed");
  }
}
