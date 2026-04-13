import { z } from "zod";

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.string().trim().max(2000000).nullable().optional(),
  contactNumber: z.string().trim().max(20).optional(),
  hostel: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  sellerHeadline: z.string().trim().max(120).optional(),
  preferredMeetupSpot: z.string().trim().max(160).optional(),
  favoriteCategories: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  notificationPreferences: z
    .object({
      buying: z.boolean().optional(),
      selling: z.boolean().optional(),
      safety: z.boolean().optional(),
      system: z.boolean().optional(),
      savedSearchAlerts: z.boolean().optional(),
    })
    .optional(),
  campusId: z.string().trim().max(80).optional(),
  setupCompleted: z.boolean().optional(),
});
