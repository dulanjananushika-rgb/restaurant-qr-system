import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import type { UserRole } from "@/domain/auth/types";
import { createAuditLog } from "@/lib/audit";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { parseJsonBody } from "@/lib/api/validation";
import { createToken } from "@/lib/auth";
import { runInTransaction } from "@/lib/db/transaction";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { loginSchema } from "@/validation/auth";

function getRedirectPath(role: UserRole) {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "KITCHEN_STAFF") return "/kitchen/orders";
  if (role === "WAITER") return "/waiter/orders";
  return "/cashier/orders";
}

export async function POST(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "staff-login", 8, 15 * 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const input = await parseJsonBody(request, loginSchema);
    await connectDB();

    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
    }
    if (user.status !== "ACTIVE") {
      throw new ApiError(403, "Account is inactive. Please contact admin.", "ACCOUNT_DISABLED");
    }

    const authUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };

    await runInTransaction(async (session) => {
      const result = await User.updateOne(
        { _id: user._id, status: "ACTIVE", role: user.role },
        { $set: { lastLoginAt: new Date() } },
        { session }
      );
      if (result.modifiedCount !== 1) {
        throw new ApiError(403, "The account is no longer active.", "ACCOUNT_DISABLED");
      }
      await createAuditLog(
        {
          action: "USER_LOGIN",
          module: "AUTH",
          description: `${user.name} logged in as ${user.role}.`,
          performedBy: user.email,
          metadata: { userId: user._id.toString(), role: user.role },
        },
        { session, failClosed: true }
      );
    });

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
      redirectTo: getRedirectPath(authUser.role),
      user: { ...authUser, status: user.status },
    });
    response.cookies.set("restaurant_token", createToken(authUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error, "Login failed");
  }
}
