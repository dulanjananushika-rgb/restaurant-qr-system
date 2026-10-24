import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

import type { UserRole } from "@/domain/auth/types";

type TokenPayload = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

const TOKEN_ISSUER = "restaurant-qr-system";
const TOKEN_AUDIENCE = "restaurant-staff";

const protectedRoutes: { path: string; roles: readonly UserRole[] }[] = [
  { path: "/admin", roles: ["ADMIN"] },
  { path: "/kitchen", roles: ["KITCHEN_STAFF", "ADMIN"] },
  { path: "/waiter", roles: ["WAITER", "ADMIN"] },
  { path: "/cashier", roles: ["CASHIER", "ADMIN"] },
  { path: "/api/admin", roles: ["ADMIN"] },
  { path: "/api/kitchen", roles: ["KITCHEN_STAFF", "ADMIN"] },
  { path: "/api/waiter", roles: ["WAITER", "ADMIN"] },
  { path: "/api/cashier", roles: ["CASHIER", "ADMIN"] },
  { path: "/api/seed", roles: ["ADMIN"] },
  { path: "/api/test-messages", roles: ["ADMIN"] },
];

function getDefaultPath(role: UserRole) {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "KITCHEN_STAFF") return "/kitchen/orders";
  if (role === "WAITER") return "/waiter/orders";
  return "/cashier/orders";
}

async function verifyRestaurantToken(token: string): Promise<TokenPayload> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Invalid JWT configuration");

  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

  return payload as TokenPayload;
}

function apiFailure(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const matchedRoute = protectedRoutes.find((route) =>
    pathname.startsWith(route.path)
  );
  const token = request.cookies.get("restaurant_token")?.value;

  if (pathname === "/login" && token) {
    try {
      const decoded = await verifyRestaurantToken(token);
      return NextResponse.redirect(new URL(getDefaultPath(decoded.role), request.url));
    } catch {
      const response = NextResponse.next();
      response.cookies.delete("restaurant_token");
      return response;
    }
  }

  if (!matchedRoute) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  if (!token) {
    return isApi
      ? apiFailure(401, "Authentication is required.")
      : NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const decoded = await verifyRestaurantToken(token);
    if (!matchedRoute.roles.includes(decoded.role)) {
      return isApi
        ? apiFailure(403, "You do not have permission for this action.")
        : NextResponse.redirect(new URL(getDefaultPath(decoded.role), request.url));
    }
    return NextResponse.next();
  } catch {
    const response = isApi
      ? apiFailure(401, "The login session is invalid or expired.")
      : NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("restaurant_token");
    return response;
  }
}

export const config = {
  matcher: [
    "/login",
    "/admin/:path*",
    "/kitchen/:path*",
    "/waiter/:path*",
    "/cashier/:path*",
    "/api/admin/:path*",
    "/api/kitchen/:path*",
    "/api/waiter/:path*",
    "/api/cashier/:path*",
    "/api/seed",
    "/api/test-messages/:path*",
  ],
};
