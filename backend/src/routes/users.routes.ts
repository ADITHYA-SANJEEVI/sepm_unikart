import { Router } from "express";
import { z } from "zod";

import { createUniKartPdf } from "../lib/formatted-pdf";
import { profileUpdateSchema } from "../lib/profile-update-schema";
import {
  addToCompareQueue,
  buildNotificationInbox,
  blockUser,
  clearCompareQueue,
  clearSavedFilters,
  deleteSavedFilter,
  dismissNotification,
  getOwnProfile,
  listCompareQueue,
  listBlocks,
  listNotifications,
  listPolicies,
  listRecentlyViewed,
  listSavedFilters,
  markAllNotificationsRead,
  markNotificationRead,
  removeFromCompareQueue,
  replaceCompareQueue,
  recordRecentlyViewed,
  saveFilter,
  updateSavedFilter,
  updateOwnProfile,
} from "../services/platform.service";
import { requireAuth } from "../middleware/auth.middleware";

const blockUserSchema = z.object({
  blockedProfileId: z.string().trim().min(1, "Blocked profile ID is required."),
});

const saveFilterSchema = z.object({
  label: z.string().trim().min(2).max(80),
  filterPayload: z.record(z.string(), z.unknown()),
  alertEnabled: z.boolean().optional(),
});

const updateSavedFilterSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  filterPayload: z.record(z.string(), z.unknown()).optional(),
  alertEnabled: z.boolean().optional(),
});

const recentViewSchema = z.object({
  listingId: z.string().trim().min(1, "Listing ID is required."),
});

const compareQueueSchema = z.object({
  listingIds: z.array(z.string().trim().min(1)).max(3),
});

const notificationPreferencesSchema = z.object({
  buying: z.boolean().optional(),
  selling: z.boolean().optional(),
  safety: z.boolean().optional(),
  system: z.boolean().optional(),
  savedSearchAlerts: z.boolean().optional(),
});

const notificationIdSchema = z.object({
  notificationId: z.string().trim().min(1, "Notification ID is required."),
});

export const usersRouter = Router();

usersRouter.get("/setup-profile", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await getOwnProfile(request.auth.user),
  });
});

usersRouter.post("/setup-profile", requireAuth, async (request, response) => {
  const parseResult = profileUpdateSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_PROFILE_UPDATE",
        message: "A valid profile update payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  return response.json({
    success: true,
    data: await updateOwnProfile(request.auth.user, parseResult.data),
  });
});

usersRouter.get("/blocked", requireAuth, async (request, response) => {
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
    data: await listBlocks(request.auth.user),
  });
});

usersRouter.get("/support/export-pdf", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const profile = await getOwnProfile(request.auth.user);
  const [blockedUsers, policies] = await Promise.all([
    listBlocks(request.auth.user).catch(() => []),
    listPolicies().catch(() => []),
  ]);

  const pdf = await createUniKartPdf({
    eyebrow: "Support packet",
    title: "UniKart Support and Safety Packet",
    subtitle: "A personal support packet covering escalation steps, blocked users, and the policy references that matter most in active transactions.",
    meta: [
      { label: "Prepared for", value: profile.fullName },
      { label: "Campus", value: profile.campusId },
      { label: "Safety alerts", value: profile.notificationPreferences?.safety ? "Enabled" : "Disabled" },
      { label: "Blocked users", value: String(blockedUsers.length) },
    ],
    sections: [
      {
        title: "Escalation reminders",
        summary: "Use these steps when a listing, message, or meetup starts to feel unsafe or manipulative.",
        bullets: [
          "Report suspicious listings, abusive chat, or payment pressure directly inside the related UniKart flow.",
          "Block users who continue manipulative, hateful, or unsafe behavior.",
          "Prefer visible campus meetup spots and inspect the item before payment.",
        ],
        tone: "warning",
      },
      {
        title: "Blocked users",
        summary: blockedUsers.length ? "These profiles are currently blocked from your side." : "No blocked users are currently on record.",
        bullets: blockedUsers.length
          ? blockedUsers.map((item: any) => item.blockedProfile?.fullName || item.blockedProfileId)
          : ["No blocked users on record."],
        tone: blockedUsers.length ? "danger" : "neutral",
      },
      {
        title: "Policy quick references",
        summary: "Use these references when deciding whether to continue a conversation, meetup, or payment.",
        bullets: policies.map((policy) => `${policy.title}: ${policy.summary}`),
        tone: "brand",
      },
    ],
    footerNote: "UniKart support and safety reference",
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", 'attachment; filename="unikart-support-packet.pdf"');
  return response.send(pdf);
});

usersRouter.post("/block", requireAuth, async (request, response) => {
  const parseResult = blockUserSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_BLOCK_REQUEST",
        message: "A valid blocked profile ID is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const result = await blockUser(request.auth.user, parseResult.data.blockedProfileId);

  if (!result) {
    return response.status(404).json({
      success: false,
      error: {
        code: "PROFILE_NOT_FOUND",
        message: "Profile not found.",
      },
    });
  }

  if ("error" in result && result.error === "SELF_BLOCK") {
    return response.status(400).json({
      success: false,
      error: {
        code: "SELF_BLOCK_NOT_ALLOWED",
        message: "You cannot block yourself.",
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: result,
  });
});

usersRouter.get("/saved-filters", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listSavedFilters(request.auth.user),
  });
});

usersRouter.get("/compare-queue", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listCompareQueue(request.auth.user),
  });
});

usersRouter.put("/compare-queue", requireAuth, async (request, response) => {
  const parseResult = compareQueueSchema.safeParse(request.body);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_COMPARE_QUEUE",
        message: "A valid compare queue payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  return response.json({
    success: true,
    data: await replaceCompareQueue(request.auth.user, parseResult.data.listingIds),
  });
});

usersRouter.post("/compare-queue/:listingId", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.status(201).json({
    success: true,
    data: await addToCompareQueue(request.auth.user, String(request.params.listingId)),
  });
});

usersRouter.delete("/compare-queue/:listingId", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await removeFromCompareQueue(request.auth.user, String(request.params.listingId)),
  });
});

usersRouter.delete("/compare-queue", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await clearCompareQueue(request.auth.user),
  });
});

usersRouter.get("/notification-preferences", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const profile = await getOwnProfile(request.auth.user);
  return response.json({
    success: true,
    data: profile.notificationPreferences ?? {
      buying: true,
      selling: true,
      safety: true,
      system: true,
      savedSearchAlerts: true,
    },
  });
});

usersRouter.patch("/notification-preferences", requireAuth, async (request, response) => {
  const parseResult = notificationPreferencesSchema.safeParse(request.body);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_NOTIFICATION_PREFERENCES",
        message: "A valid notification preferences payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const updated = await updateOwnProfile(request.auth.user, {
    notificationPreferences: parseResult.data,
  });
  return response.json({
    success: true,
    data: updated.notificationPreferences,
  });
});

usersRouter.post("/saved-filters", requireAuth, async (request, response) => {
  const parseResult = saveFilterSchema.safeParse(request.body);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_SAVED_FILTER",
        message: "A valid saved filter payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: await saveFilter(request.auth.user, parseResult.data),
  });
});

usersRouter.patch("/saved-filters/:filterId", requireAuth, async (request, response) => {
  const parseResult = updateSavedFilterSchema.safeParse(request.body);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_SAVED_FILTER_UPDATE",
        message: "A valid saved filter update payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const updated = await updateSavedFilter(String(request.params.filterId), request.auth.user, parseResult.data);
  if (!updated) {
    return response.status(404).json({
      success: false,
      error: {
        code: "SAVED_FILTER_NOT_FOUND",
        message: "Saved filter not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: updated,
  });
});

usersRouter.delete("/saved-filters/:filterId", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const deleted = await deleteSavedFilter(String(request.params.filterId), request.auth.user);
  if (!deleted) {
    return response.status(404).json({
      success: false,
      error: {
        code: "SAVED_FILTER_NOT_FOUND",
        message: "Saved filter not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: { deleted: true },
  });
});

usersRouter.delete("/saved-filters", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await clearSavedFilters(request.auth.user),
  });
});

usersRouter.get("/recently-viewed", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listRecentlyViewed(request.auth.user),
  });
});

usersRouter.post("/recently-viewed", requireAuth, async (request, response) => {
  const parseResult = recentViewSchema.safeParse(request.body);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_RECENT_VIEW",
        message: "A valid listing ID is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  await recordRecentlyViewed(request.auth.user, parseResult.data.listingId);
  return response.status(201).json({
    success: true,
    data: { recorded: true },
  });
});

usersRouter.get("/notifications", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listNotifications(request.auth.user),
  });
});

usersRouter.get("/notifications/inbox", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const notifications = await listNotifications(request.auth.user);
  return response.json({
    success: true,
    data: buildNotificationInbox(notifications),
  });
});

usersRouter.get("/notification-inbox", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const notifications = await listNotifications(request.auth.user);
  return response.json({
    success: true,
    data: buildNotificationInbox(notifications),
  });
});

usersRouter.patch("/notifications/read-all", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await markAllNotificationsRead(request.auth.user),
  });
});

usersRouter.patch("/notifications/:notificationId/read", requireAuth, async (request, response) => {
  const parseResult = notificationIdSchema.safeParse(request.params);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_NOTIFICATION_ID",
        message: "A valid notification ID is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const updated = await markNotificationRead(parseResult.data.notificationId, request.auth.user);
  if (!updated) {
    return response.status(404).json({
      success: false,
      error: {
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: updated,
  });
});

usersRouter.delete("/notifications/:notificationId", requireAuth, async (request, response) => {
  const parseResult = notificationIdSchema.safeParse(request.params);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_NOTIFICATION_ID",
        message: "A valid notification ID is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const updated = await dismissNotification(parseResult.data.notificationId, request.auth.user);
  if (!updated) {
    return response.status(404).json({
      success: false,
      error: {
        code: "NOTIFICATION_NOT_FOUND",
        message: "Notification not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: updated,
  });
});
