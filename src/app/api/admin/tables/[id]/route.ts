import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { connectDB } from "@/lib/mongodb";
import Table from "@/models/Table";
import Order from "@/models/Order";
import { createAuditLog } from "@/lib/audit";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { updateTableSchema } from "@/validation/admin";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
    await connectDB();
    const { id } = await params;
    const { name, capacity, status } = await parseJsonBody(
      request,
      updateTableSchema
    );

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (capacity !== undefined) {
      updateData.capacity = capacity;
    }
    if (status !== undefined) updateData.status = status;

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
      performedBy: auth.user.email,
      metadata: { tableId: id, updatedFields: Object.keys(updateData) },
    });

    return NextResponse.json({
      success: true,
      message: "Table updated successfully",
      data: table,
    });
  } catch (error) {
    return apiErrorResponse(error, "Table update failed");
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;
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
      performedBy: auth.user.email,
      metadata: { tableId: id, tableName: deletedTable.name },
    });

    return NextResponse.json({
      success: true,
      message: "Table deleted successfully",
    });
  } catch (error) {
    return apiErrorResponse(error, "Table deletion failed");
  }
}
