import type { ZodType } from "zod";

import { ApiError } from "@/lib/api/errors";

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "A valid JSON request body is required.", "INVALID_JSON");
  }
  return schema.parse(body);
}
