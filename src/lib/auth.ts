import jwt from "jsonwebtoken";

import type { AuthUser } from "@/domain/auth/types";

export type { AuthUser, UserRole } from "@/domain/auth/types";

const TOKEN_ISSUER = "restaurant-qr-system";
const TOKEN_AUDIENCE = "restaurant-staff";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export function createToken(user: AuthUser) {
  return jwt.sign(user, getJwtSecret(), {
    algorithm: "HS256",
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: "7d",
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  }) as AuthUser;
}
