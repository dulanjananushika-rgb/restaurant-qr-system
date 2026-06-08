import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const { name, email, password, role, status } = body;

    if (!name || !email || !role || !status) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email, role and status are required",
        },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: id },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Another staff member already uses this email",
        },
        { status: 400 }
      );
    }

    const updateData: {
      name: string;
      email: string;
      role: string;
      status: string;
      password?: string;
    } = {
      name,
      email: email.toLowerCase().trim(),
      role,
      status,
    };

    if (password && password.trim().length > 0) {
      if (password.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be at least 6 characters",
          },
          { status: 400 }
        );
      }

      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");

    if (!updatedUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Staff member not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Staff member updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Staff PATCH API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update staff member",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}