import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import TestMessage from "@/models/TestMessage";

export async function GET() {
  try {
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
    console.error("GET /api/test-messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch messages",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();

    if (!body.name || !body.message) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and message are required",
        },
        { status: 400 }
      );
    }

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
    console.error("POST /api/test-messages error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save message",
      },
      { status: 500 }
    );
  }
}