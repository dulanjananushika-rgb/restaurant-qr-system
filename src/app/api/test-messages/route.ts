import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireApiUser } from "@/lib/api/auth";
import TestMessage from "@/models/TestMessage";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/validation";
import { testMessageSchema } from "@/validation/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;

    if (process.env.ENABLE_TEST_ENDPOINTS !== "true") {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    await connectDB();

    const messages = await TestMessage.find()
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    return apiErrorResponse(error, "Test message list failed");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(request, ["ADMIN"]);
    if (!auth.ok) return auth.response;

    if (process.env.ENABLE_TEST_ENDPOINTS !== "true") {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    await connectDB();

    const body = await parseJsonBody(request, testMessageSchema);

    const newMessage = await TestMessage.create({
      name: body.name,
      message: body.message,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Message saved successfully",
        data: newMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Test message creation failed");
  }
}
