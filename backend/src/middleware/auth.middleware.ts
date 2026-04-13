import type { NextFunction, Request, Response } from "express";
import { resolveAuthUser } from "../services/auth.service";

export async function attachAuthContext(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await resolveAuthUser(request);
    request.auth = { user };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (!request.auth?.user) {
    response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
    return;
  }

  next();
}

export function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  if (request.auth?.user?.role !== "admin") {
    response.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Admin access required.",
      },
    });
    return;
  }

  next();
}