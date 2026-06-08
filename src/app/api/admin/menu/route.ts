import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import MenuItem from "@/models/MenuItem";
import "@/models/Category";

export async function GET() {
  try {
    await connectDB();

    const menuItems = await MenuItem.find()
      .sort({ createdAt: -1 })
      .populate("category")
      .lean();

    return NextResponse.json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.error("Menu GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load menu items",
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
    const { name, price, category, available, image, description } = body;

    if (!name || !price || !category) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, price and category are required",
        },
        { status: 400 }
      );
    }

    if (Number(price) <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Price must be greater than 0",
        },
        { status: 400 }
      );
    }

    const menuItem = await MenuItem.create({
      name,
      price: Number(price),
      category,
      available: Boolean(available),
      image: image || "",
      description: description || "",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Menu item created successfully",
        data: menuItem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Menu POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create menu item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}