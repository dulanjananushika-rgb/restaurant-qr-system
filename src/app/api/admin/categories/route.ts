import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";

export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Categories GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load categories",
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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Category name is required",
        },
        { status: 400 }
      );
    }

    const category = await Category.create({
      name,
      description: description || "",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Category created successfully",
        data: category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Categories POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create category",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}