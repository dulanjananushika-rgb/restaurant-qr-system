import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Supplier from "@/models/Supplier";

export async function GET() {
  try {
    await connectDB();

    const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    console.error("Suppliers GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load suppliers",
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

    const {
      name,
      contactPerson = "",
      phone = "",
      email = "",
      address = "",
      status = "ACTIVE",
    } = body as {
      name: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      address?: string;
      status?: "ACTIVE" | "INACTIVE";
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier name is required",
        },
        { status: 400 }
      );
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid supplier status",
        },
        { status: 400 }
      );
    }

    const existingSupplier = await Supplier.findOne({
      name: name.trim(),
    });

    if (existingSupplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier with this name already exists",
        },
        { status: 400 }
      );
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      status,
    });

    await createAuditLog({
      action: "SUPPLIER_CREATED",
      module: "SUPPLIERS",
      description: `Supplier "${supplier.name}" created.`,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier created successfully",
        data: supplier,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Suppliers POST error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create supplier",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}