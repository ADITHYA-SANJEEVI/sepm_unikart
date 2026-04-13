import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware";
import { getDashboardSummary, getUserAnalytics, getPlatformAnalytics } from "../services/platform.service";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  return response.json({
    success: true,
    data: await getDashboardSummary(request.auth.user),
  });
});

dashboardRouter.get("/analytics", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  return response.json({
    success: true,
    data: await getUserAnalytics(request.auth.user),
  });
});

dashboardRouter.get("/platform-analytics", requireAuth, async (request, response) => {
  if (!request.auth.user || request.auth.user.role !== "admin") {
    return response.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Admin access required.",
      },
    });
  }

  return response.json({
    success: true,
    data: await getPlatformAnalytics(),
  });
});
