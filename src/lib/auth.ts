import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Please add JWT_SECRET to .env.local");
}

export type UserRole = "ADMIN" | "KITCHEN_STAFF" | "WAITER" | "CASHIER";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function createToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET as string, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET as string) as AuthUser;
}