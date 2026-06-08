import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await connectDB();

    const staff = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error("Staff GET API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load staff members",
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
    const { name, email, password, role, status } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email, password and role are required",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters",
        },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "A staff member with this email already exists",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      status: status || "ACTIVE",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Staff member created successfully",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Staff POST API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create staff member",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}