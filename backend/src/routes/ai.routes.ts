import { Router } from "express";
import { z } from "zod";

import {
  assistSearchQuery,
  getListingAssist,
  moderateChatMessage,
  moderateListingContent,
  summarizeReportForAdmin,
} from "../services/ai.service";
import { requireAuth } from "../middleware/auth.middleware";

const listingAssistSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  category: z.string().trim().optional(),
  price: z.number().nonnegative().optional(),
});

const chatModerationSchema = z.object({
  listingId: z.string().trim().optional(),
  message: z.string().trim().min(1).max(1000),
});

const searchAssistSchema = z.object({
  query: z.string().trim().min(2).max(200),
});

export const aiRouter = Router();

aiRouter.post("/listing-assist", requireAuth, async (request, response, next) => {
  try {
    const parseResult = listingAssistSchema.safeParse(request.body);

    if (!parseResult.success) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_AI_REQUEST",
          message: "A valid listing assist payload is required.",
          details: parseResult.error.flatten(),
        },
      });
    }

    return response.json({
      success: true,
      data: await getListingAssist(parseResult.data),
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/moderate/listing", requireAuth, async (request, response, next) => {
  try {
    const parseResult = listingAssistSchema.safeParse(request.body);

    if (!parseResult.success) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_AI_REQUEST",
          message: "A valid listing moderation payload is required.",
          details: parseResult.error.flatten(),
        },
      });
    }

    return response.json({
      success: true,
      data: await moderateListingContent(parseResult.data),
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/moderate/chat", requireAuth, async (request, response, next) => {
  try {
    const parseResult = chatModerationSchema.safeParse(request.body);

    if (!parseResult.success) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_AI_REQUEST",
          message: "A valid chat moderation payload is required.",
          details: parseResult.error.flatten(),
        },
      });
    }

    return response.json({
      success: true,
      data: await moderateChatMessage(parseResult.data),
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.get("/admin/report-summary/:reportId", requireAuth, async (request, response, next) => {
  try {
    if (!request.auth.user) {
      return response.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const reportId = String(request.params.reportId);
    const summary = await summarizeReportForAdmin(reportId, request.auth.user);

    if (!summary) {
      return response.status(404).json({
        success: false,
        error: {
          code: "REPORT_NOT_FOUND",
          message: "Report not found.",
        },
      });
    }

    return response.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

aiRouter.post("/search-assist", requireAuth, async (request, response, next) => {
  try {
    const parseResult = searchAssistSchema.safeParse(request.body);

    if (!parseResult.success) {
      return response.status(400).json({
        success: false,
        error: {
          code: "INVALID_AI_REQUEST",
          message: "A valid search assist payload is required.",
          details: parseResult.error.flatten(),
        },
      });
    }

    return response.json({
      success: true,
      data: await assistSearchQuery(parseResult.data),
    });
  } catch (error) {
    next(error);
  }
});
