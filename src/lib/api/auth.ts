import { NextResponse } from "next/server";

import type { ActiveAuthUser, UserRole } from "@/domain/auth/types";
import { verifyToken } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

type AuthSuccess = { ok: true; user: ActiveAuthUser };
type AuthFailure = { ok: false; response: NextResponse };
export type ApiAuthResult = AuthSuccess | AuthFailure;

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return Boolean(host) && originUrl.host === host;
  } catch {
    return false;
  }
}

function failure(status: number, message: string, code: string): AuthFailure {
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, message, code },
      { status }
    ),
  };
}

export async function requireApiUser(
  request: Request,
  allowedRoles: readonly UserRole[]
): Promise<ApiAuthResult> {
  if (isUnsafeMethod(request.method) && !isSameOrigin(request)) {
    return failure(403, "Cross-origin requests are not allowed.", "INVALID_ORIGIN");
  }

  const token = getCookie(request, "restaurant_token");
  if (!token) {
    return failure(401, "Authentication is required.", "UNAUTHENTICATED");
  }

  let tokenUser;
  try {
    tokenUser = verifyToken(token);
  } catch {
    return failure(401, "The login session is invalid or expired.", "INVALID_SESSION");
  }

  if (!allowedRoles.includes(tokenUser.role)) {
    return failure(403, "You do not have permission for this action.", "FORBIDDEN");
  }

  await connectDB();

  const databaseUser = await User.findOne({
    _id: tokenUser.id,
    status: "ACTIVE",
  })
    .select("_id name email role status workStatus")
    .lean<{
      _id: { toString(): string };
      name: string;
      email: string;
      role: UserRole;
      status: "ACTIVE";
      workStatus?: ActiveAuthUser["workStatus"];
    }>();

  if (!databaseUser || !allowedRoles.includes(databaseUser.role)) {
    return failure(403, "The account is inactive or no longer authorized.", "ACCOUNT_DISABLED");
  }

  return {
    ok: true,
    user: {
      id: databaseUser._id.toString(),
      name: databaseUser.name,
      email: databaseUser.email,
      role: databaseUser.role,
      status: databaseUser.status,
      workStatus: databaseUser.workStatus,
    },
  };
}
