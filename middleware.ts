import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

type UserRole = "ADMIN" | "KITCHEN_STAFF" | "WAITER" | "CASHIER";

type TokenPayload = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

const protectedRoutes: {
  path: string;
  roles: UserRole[];
}[] = [
  {
    path: "/admin",
    roles: ["ADMIN"],
  },
  {
    path: "/kitchen",
    roles: ["KITCHEN_STAFF", "ADMIN"],
  },
  {
    path: "/waiter",
    roles: ["WAITER", "ADMIN"],
  },
  {
    path: "/cashier",
    roles: ["CASHIER", "ADMIN"],
  },
];

function getDefaultPath(role: UserRole) {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "KITCHEN_STAFF") return "/kitchen/orders";
  if (role === "WAITER") return "/waiter/orders";
  if (role === "CASHIER") return "/cashier/orders";

  return "/login";
}

async function verifyRestaurantToken(token: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  const secretKey = new TextEncoder().encode(secret);

  const { payload } = await jwtVerify(token, secretKey);

  return payload as TokenPayload;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchedRoute = protectedRoutes.find((route) =>
    pathname.startsWith(route.path)
  );

  const token = request.cookies.get("restaurant_token")?.value;

  if (pathname === "/login" && token) {
    try {
      const decoded = await verifyRestaurantToken(token);

      return NextResponse.redirect(
        new URL(getDefaultPath(decoded.role), request.url)
      );
    } catch {
      const response = NextResponse.next();
      response.cookies.delete("restaurant_token");
      return response;
    }
  }

  if (!matchedRoute) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const decoded = await verifyRestaurantToken(token);

    if (!matchedRoute.roles.includes(decoded.role)) {
      return NextResponse.redirect(
        new URL(getDefaultPath(decoded.role), request.url)
      );
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
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
  ],
};