/**
 * Q-4: Shared Zod validation helpers for API routes.
 * Centralizes request body parsing & error formatting.
 */
import { z, ZodSchema } from "zod";
import { NextResponse } from "next/server";

/**
 * Parse request JSON body against a Zod schema.
 * Returns `{ data }` on success or a pre-built `NextResponse` on failure.
 */
export async function parseBody<T extends ZodSchema>(
  req: Request,
  schema: T,
): Promise<
  | { data: z.infer<T>; error?: never }
  | { data?: never; error: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return {
      error: NextResponse.json(
        { error: "Validation failed", issues },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
