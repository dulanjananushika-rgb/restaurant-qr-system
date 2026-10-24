import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

declare global {
  var restaurantRateLimits: Map<string, Bucket> | undefined;
}

const buckets = global.restaurantRateLimits ?? new Map<string, Bucket>();
global.restaurantRateLimits = buckets;

function requestIdentity(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const now = Date.now();
  const key = `${scope}:${requestIdentity(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(
    {
      success: false,
      message: "Too many requests. Please try again shortly.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}
