import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { createTableSchema } from "@/validation/admin";

function generateQrCode(name: string) {
  const cleanName = name.trim().replace(/\s+/g, "_").toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `${cleanName}_${random}`;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const tables = await Table.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: tables,
    });
  } catch (error) {
    return apiErrorResponse(error, "Table list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const { name, capacity } = await parseJsonBody(request, createTableSchema);

    const table = await Table.create({
      name,
      capacity,
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
    return apiErrorResponse(error, "Table creation failed");
  }
}
