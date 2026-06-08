import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

export async function GET() {
  try {
    await connectDB();

    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Audit logs GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load audit logs",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}