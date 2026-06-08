import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/mongodb";
import { createToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

import User from "@/models/User";

function getRedirectPath(role: string) {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "KITCHEN_STAFF") return "/kitchen/orders";
  if (role === "WAITER") return "/waiter/orders";
  if (role === "CASHIER") return "/cashier/orders";

  return "/login";
}

export async function POST(request: Request) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password } = body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Account is inactive. Please contact admin.",
        },
        { status: 403 }
      );
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const token = createToken({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    user.lastLoginAt = new Date();
    await user.save();

    await createAuditLog({
      action: "USER_LOGIN",
      module: "AUTH",
      description: `${user.name} logged in as ${user.role}.`,
    });

    const redirectTo = getRedirectPath(user.role);

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      redirectTo,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });

   response.cookies.set("restaurant_token", token, {
     httpOnly: true,
     sameSite: "lax",
     secure: process.env.NODE_ENV === "production",
     path: "/",
     maxAge: 60 * 60 * 24 * 7,
   });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Login failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}