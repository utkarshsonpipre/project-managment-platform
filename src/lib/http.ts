import { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { apiRequestsCounter } from "@/lib/metrics";

/** Throw this anywhere inside a route handler to return a clean HTTP error. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RouteHandler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

/**
 * Wraps a route handler so thrown ApiError / ZodError become proper JSON
 * responses instead of unhandled 500s.
 */
export function route<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    let res: Response;
    try {
      res = await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        res = Response.json({ error: err.message }, { status: err.status });
      } else if (err instanceof ZodError) {
        res = Response.json(
          {
            error: "Validation failed",
            issues: err.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 422 },
        );
      } else {
        console.error("[API] Unhandled error:", err);
        res = Response.json({ error: "Internal server error" }, { status: 500 });
      }
    }
    try {
      apiRequestsCounter().inc({ status: String(res.status) });
    } catch {
      // never let metrics break a response
    }
    return res;
  };
}

/** Parse + validate a JSON request body against a Zod schema. */
export async function readJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  return schema.parse(raw);
}
