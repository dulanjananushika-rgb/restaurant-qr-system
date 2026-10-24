import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";

import MenuItem from "@/models/MenuItem";
import "@/models/Category";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { menuItemSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
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
    return apiErrorResponse(error, "Menu list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { name, price, category, available, image, description } =
      await parseJsonBody(request, menuItemSchema);

    const menuItem = await MenuItem.create({
      name,
      price,
      category,
      available,
      image,
      description,
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
    return apiErrorResponse(error, "Menu item creation failed");
  }
}
