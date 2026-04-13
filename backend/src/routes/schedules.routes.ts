import { Router } from "express";
import { z } from "zod";

import { createSchedule, listSchedules, updateScheduleStatus } from "../services/platform.service";
import { requireAuth } from "../middleware/auth.middleware";

const meetupLocationSchema = z.object({
  label: z.string().trim().min(2).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  campusId: z.string().trim().max(80).optional(),
  zoneId: z.string().trim().max(80).optional().nullable(),
  zoneLabel: z.string().trim().max(120).optional().nullable(),
  placeType: z.enum(["campus_zone", "custom_pin"]).optional(),
  addressHint: z.string().trim().max(200).optional().nullable(),
});

const meetupRoutePointSchema = z.object({
  label: z.string().trim().max(160).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  x: z.number().min(0).max(100).optional().nullable(),
  y: z.number().min(0).max(100).optional().nullable(),
  kind: z.enum(["origin", "waypoint", "destination"]).optional(),
});

const meetupRouteSchema = z.object({
  provider: z.enum(["campus_graph", "google_maps", "tomtom"]),
  travelMode: z.literal("walking"),
  originLabel: z.string().trim().min(2).max(160),
  originLatitude: z.number().min(-90).max(90),
  originLongitude: z.number().min(-180).max(180),
  destinationLabel: z.string().trim().min(2).max(160),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
  durationMinutes: z.number().min(0).max(1440),
  distanceMeters: z.number().min(0).max(250000),
  summary: z.string().trim().max(200).optional().nullable(),
  computedAt: z.string().trim().min(1).max(80),
  path: z.array(meetupRoutePointSchema).min(2).max(24),
});

const createScheduleSchema = z.object({
  listingId: z.string().trim().min(1, "Listing ID is required."),
  requestedMode: z.enum(["meetup", "pickup", "campus-drop", "hostel-meetup"]),
  proposedTime: z.string().trim().min(1, "Proposed time is required."),
  notes: z.string().trim().max(500).optional(),
  meetupLocation: meetupLocationSchema.optional(),
  meetupRoute: meetupRouteSchema.optional(),
});

const updateScheduleSchema = z.object({
  status: z.enum(["proposed", "confirmed", "reschedule_requested", "completed", "cancelled"]),
  proposedTime: z.string().trim().min(1).optional(),
  confirmedTime: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
  meetupLocation: meetupLocationSchema.optional(),
  meetupRoute: meetupRouteSchema.optional(),
});

export const schedulesRouter = Router();

schedulesRouter.get("/", requireAuth, async (request, response) => {
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
    data: await listSchedules(request.auth.user),
  });
});

schedulesRouter.post("/", requireAuth, async (request, response) => {
  const parseResult = createScheduleSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_SCHEDULE_REQUEST",
        message: "A valid schedule payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const result = await createSchedule(request.auth.user, parseResult.data);

  if (!result) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  if ("error" in result && result.error === "SELF_SCHEDULE") {
    return response.status(400).json({
      success: false,
      error: {
        code: "SELF_SCHEDULE_NOT_ALLOWED",
        message: "You cannot create a schedule for your own listing.",
      },
    });
  }

  if ("error" in result && result.error === "BLOCKED") {
    return response.status(403).json({
      success: false,
      error: {
        code: "SCHEDULE_BLOCKED",
        message: "Scheduling is blocked between these users.",
      },
    });
  }

  if ("error" in result && result.error === "PAST_DATE") {
    return response.status(400).json({
      success: false,
      error: {
        code: "PAST_MEETUP_NOT_ALLOWED",
        message: "Meetups must be scheduled for a future date and time.",
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: result,
  });
});

schedulesRouter.patch("/:scheduleId", requireAuth, async (request, response) => {
  const parseResult = updateScheduleSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_SCHEDULE_UPDATE",
        message: "A valid schedule update payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const scheduleId = String(request.params.scheduleId);
  const result = await updateScheduleStatus(scheduleId, request.auth.user, parseResult.data);

  if (!result) {
    return response.status(404).json({
      success: false,
      error: {
        code: "SCHEDULE_NOT_FOUND",
        message: "Schedule not found.",
      },
    });
  }

  if ("error" in result && result.error === "FORBIDDEN") {
    return response.status(403).json({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "You cannot update this schedule.",
      },
    });
  }

  if ("error" in result && result.error === "PAST_DATE") {
    return response.status(400).json({
      success: false,
      error: {
        code: "PAST_MEETUP_NOT_ALLOWED",
        message: "Meetups must be scheduled for a future date and time.",
      },
    });
  }

  if ("error" in result && result.error === "INVALID_TRANSITION") {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_SCHEDULE_TRANSITION",
        message: "This meetup transition is not allowed from the current state.",
      },
    });
  }

  return response.json({
    success: true,
    data: result,
  });
});
