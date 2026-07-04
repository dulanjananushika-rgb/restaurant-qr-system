import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import Order from "@/models/Order";
import { createAuditLog } from "@/lib/audit";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { name, capacity, status } = body;

    if (!name && !capacity && !status) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one field (name, capacity, or status) is required to update",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name && typeof name === "string") {
      updateData.name = name.trim();
    }
    if (capacity !== undefined) {
      const cap = Number(capacity);
      if (cap < 1) {
        return NextResponse.json(
          { success: false, message: "Capacity must be at least 1" },
          { status: 400 }
        );
      }
      updateData.capacity = cap;
    }
    if (status && ["AVAILABLE", "OCCUPIED", "RESERVED", "INACTIVE"].includes(status)) {
      updateData.status = status;
    }

    const table = await Table.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!table) {
      return NextResponse.json(
        { success: false, message: "Table not found" },
        { status: 404 }
      );
    }

    await createAuditLog({
      action: "TABLE_UPDATED",
      module: "TABLES",
      description: `Table "${table.name}" was updated`,
      performedBy: "Admin",
      metadata: { tableId: id, updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json({
      success: true,
      message: "Table updated successfully",
      data: table,
    });
  } catch (error) {
    console.error("Tables PATCH API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update table",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    const { id } = await params;

    const orderCount = await Order.countDocuments({ table: id });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "This table has existing orders. Set it as INACTIVE instead of deleting.",
        },
        { status: 400 }
      );
    }

    const deletedTable = await Table.findByIdAndDelete(id);

    if (!deletedTable) {
      return NextResponse.json(
        { success: false, message: "Table not found" },
        { status: 404 }
      );
    }

    await createAuditLog({
      action: "TABLE_DELETED",
      module: "TABLES",
      description: `Table "${deletedTable.name}" was permanently deleted`,
      performedBy: "Admin",
      metadata: { tableId: id, tableName: deletedTable.name },
    });

    return NextResponse.json({
      success: true,
      message: "Table deleted successfully",
    });
  } catch (error) {
    console.error("Tables DELETE API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete table",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}