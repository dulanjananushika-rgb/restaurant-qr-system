import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";

import Supplier from "@/models/Supplier";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { supplierSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    return apiErrorResponse(error, "Supplier list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();

    const {
      name,
      contactPerson = "",
      phone = "",
      email = "",
      address = "",
      status = "ACTIVE",
    } = await parseJsonBody(request, supplierSchema);

    const existingSupplier = await Supplier.findOne({
      name,
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
      name,
      contactPerson,
      phone,
      email,
      address,
      status,
    });

    await createAuditLog({
      action: "SUPPLIER_CREATED",
      module: "SUPPLIERS",
      description: `Supplier "${supplier.name}" created.`,
      performedBy: auth.user.email,
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
    return apiErrorResponse(error, "Supplier creation failed");
  }
}
