import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import MenuItem from "@/models/MenuItem";
import "@/models/Category";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;

    const menuItem = await MenuItem.findById(id).populate("category").lean();

    if (!menuItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Menu item not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: menuItem,
    });
  } catch (error) {
    console.error("Single Menu GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load menu item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
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

    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      id,
      {
        name,
        price: Number(price),
        category,
        available: Boolean(available),
        image: image || "",
        description: description || "",
      },
      { new: true }
    );

    if (!updatedMenuItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Menu item not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Menu item updated successfully",
      data: updatedMenuItem,
    });
  } catch (error) {
    console.error("Single Menu PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update menu item",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}