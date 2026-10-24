import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "REQUEST_FAILED",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown, context: string) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        message: "The request contains invalid data.",
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return NextResponse.json(
      {
        success: false,
        message: "A supplied identifier is invalid.",
        code: "INVALID_IDENTIFIER",
      },
      { status: 400 }
    );
  }

  console.error(`${context}:`, error);
  return NextResponse.json(
    {
      success: false,
      message: "An unexpected server error occurred.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 }
  );
}
