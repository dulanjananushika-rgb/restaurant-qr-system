import { z } from "zod";

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "A valid identifier is required.");

export const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().default("");

export const positiveInteger = z.coerce.number().int().positive();
export const nonNegativeNumber = z.coerce.number().finite().nonnegative();
