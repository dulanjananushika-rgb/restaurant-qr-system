import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";

function generateQrCode(name: string) {
  const cleanName = name.trim().replace(/\s+/g, "_").toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `${cleanName}_${random}`;
}

export async function GET() {
  try {
    await connectDB();

    const tables = await Table.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: tables,
    });
  } catch (error) {
    console.error("Tables GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load tables",
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
    const { name, capacity } = body;

    if (!name || !capacity) {
      return NextResponse.json(
        {
          success: false,
          message: "Table name and capacity are required",
        },
        { status: 400 }
      );
    }

    const table = await Table.create({
      name,
      capacity: Number(capacity),
      qrCode: generateQrCode(name),
      status: "AVAILABLE",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Table created successfully",
        data: table,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tables POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create table",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}