import { Router } from "express";
import { z } from "zod";

import { getAiDiagnosticsSummary, listAiArtifacts, listAiProviderEvents } from "../services/ai.service";
import { addModerationAction, getAdminAnalytics, getReportById, getListingById, getPlatformAnalytics, getPublicProfileById, listModerationActions, listPolicies, listReports } from "../services/platform.service";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware";
import { createUniKartPdf } from "../lib/formatted-pdf";
import type { ModerationAction, PolicyArticle } from "../types/marketplace";

export const adminRouter = Router();

const moderationActionSchema = z.object({
  action: z.enum([
    "warn_user",
    "hide_listing",
    "suspend_listing",
    "suspend_account",
    "ban_account",
  ]),
  note: z.string().trim().max(1000).optional(),
});

adminRouter.get("/reports", requireAuth, requireAdmin, async (_request, response) => {
  return response.json({
    success: true,
    data: await listReports(),
  });
});

adminRouter.get("/moderation-actions", requireAuth, requireAdmin, async (_request, response) => {
  return response.json({
    success: true,
    data: await listModerationActions(),
  });
});

adminRouter.get("/analytics", requireAuth, requireAdmin, async (_request, response) => {
  return response.json({
    success: true,
    data: await getAdminAnalytics(),
  });
});

adminRouter.get("/platform-analytics", requireAuth, requireAdmin, async (_request, response) => {
  return response.json({
    success: true,
    data: await getPlatformAnalytics(),
  });
});

adminRouter.get("/ai-artifacts", requireAuth, requireAdmin, async (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  return response.json({
    success: true,
    data: await listAiArtifacts(Number.isFinite(limit) ? limit : 50),
  });
});

adminRouter.get("/ai-provider-events", requireAuth, requireAdmin, async (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  return response.json({
    success: true,
    data: await listAiProviderEvents(Number.isFinite(limit) ? limit : 50),
  });
});

adminRouter.get("/ai-diagnostics", requireAuth, requireAdmin, async (_request, response) => {
  return response.json({
    success: true,
    data: await getAiDiagnosticsSummary(),
  });
});

adminRouter.get("/reports/:reportId/export-pdf", requireAuth, requireAdmin, async (request, response) => {
  const reportId = String(request.params.reportId);
  const report = await getReportById(reportId);

  if (!report) {
    return response.status(404).json({
      success: false,
      error: { code: "REPORT_NOT_FOUND", message: "Report not found." },
    });
  }

  const [listing, reporter, actions, policies] = await Promise.all([
    report.targetType === "listing" ? getListingById(report.targetId, request.auth.user ?? undefined) : Promise.resolve(null),
    getPublicProfileById(report.reporterProfileId),
    listModerationActions(),
    listPolicies(),
  ]);

  const reportActions = actions.filter((item: ModerationAction & { admin?: { fullName?: string | null } | null }) => item.reportId === reportId);
  const pdf = await createUniKartPdf({
    eyebrow: "Moderation export",
    title: "UniKart Moderation Evidence Packet",
    subtitle: "A structured evidence packet for operator review, including listing context, moderation history, and policy references.",
    meta: [
      { label: "Report ID", value: report.id },
      { label: "Reason", value: report.reason },
      { label: "Severity", value: report.severity },
      { label: "Status", value: report.status },
    ],
    sections: [
      {
        title: "Report context",
        facts: [
          { label: "Target type", value: report.targetType },
          { label: "Target ID", value: report.targetId },
          { label: "Reported by", value: reporter?.fullName || report.reporterProfileId },
          { label: "Created", value: new Date(report.createdAt).toLocaleString("en-IN") },
        ],
        paragraphs: [report.details || "No extra details supplied."],
        tone: report.severity === "high" ? "danger" : report.severity === "medium" ? "warning" : "neutral",
      },
      {
        title: "Listing context",
        summary: listing ? "The reported listing was still available when this export was generated." : "The listing is unavailable or no longer visible.",
        bullets: listing
          ? [
            `${listing.title} | ${listing.status} | Rs. ${listing.price} | Seller: ${listing.seller?.fullName || "Campus Seller"}`,
            `Area: ${listing.area}`,
          ]
          : ["Listing unavailable or no longer visible."],
      },
      {
        title: "Moderation actions",
        summary: reportActions.length ? "Recorded operator actions tied to this report." : "No moderation actions are recorded yet.",
        bullets: reportActions.length
          ? reportActions.map((item: ModerationAction & { admin?: { fullName?: string | null } | null }) =>
            `${item.action} by ${item.admin?.fullName || "Admin"} on ${new Date(item.createdAt).toLocaleString("en-IN")} | ${item.note || "No note"}`,
          )
          : ["No moderation actions yet."],
        tone: "brand",
      },
      {
        title: "Policy references",
        summary: "Use these references when deciding whether to warn, hide, suspend, or ban.",
        bullets: policies.map((policy: PolicyArticle) => `${policy.title}: ${policy.summary}`),
      },
    ],
    footerNote: "UniKart moderation evidence export",
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=\"unikart-report-${report.id}.pdf\"`);
  return response.send(pdf);
});

adminRouter.post("/reports/:reportId/actions", requireAuth, requireAdmin, async (request, response) => {
  const parseResult = moderationActionSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MODERATION_ACTION",
        message: "A valid moderation action payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const reportId = String(request.params.reportId);
  const result = await addModerationAction(reportId, request.auth.user, parseResult.data);

  if (!result) {
    return response.status(404).json({
      success: false,
      error: {
        code: "REPORT_NOT_FOUND",
        message: "Report not found.",
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: result,
  });
});
