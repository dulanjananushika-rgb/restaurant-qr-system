import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Table from "@/models/Table";
import MenuItem from "@/models/MenuItem";
import Category from "@/models/Category";

type RouteParams = {
  params: Promise<{
    qrCode: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { qrCode } = await params;

    const table = await Table.findOne({
      qrCode: qrCode.toUpperCase(),
    }).lean();

    if (!table) {
      return NextResponse.json(
        {
          success: false,
          message: "Table not found",
        },
        { status: 404 }
      );
    }

    const categories = await Category.find().sort({ name: 1 }).lean();

    const menuItems = await MenuItem.find({
      available: true,
    })
      .sort({ createdAt: -1 })
      .populate("category")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        table,
        categories,
        menuItems,
      },
    });
  } catch (error) {
    console.error("Public table API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load table menu",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}