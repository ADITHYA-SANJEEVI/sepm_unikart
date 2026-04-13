import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.middleware";
import {
  completeListingMediaUpload,
  createListingMediaUploadTicket,
  deleteListingMediaAsset,
  listMediaAssetsForListing,
} from "../services/platform.service";

export const mediaRouter = Router();

const uploadTicketSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().min(3).max(120),
  mediaKind: z.enum(["image", "video"]),
  fileSizeBytes: z.number().int().positive().max(15 * 1024 * 1024).optional(),
  listingId: z.string().trim().optional(),
  sortOrder: z.number().int().min(0).max(20).optional(),
});

const finalizeMediaSchema = z.object({
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  checksum: z.string().trim().max(180).optional(),
  uploadStatus: z.enum(["uploaded", "ready", "failed"]).optional(),
});

mediaRouter.post("/upload-ticket", requireAuth, async (request, response) => {
  const parseResult = uploadTicketSchema.safeParse(request.body);
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEDIA_UPLOAD_REQUEST",
        message: "A valid media upload request is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  try {
    return response.status(201).json({
      success: true,
      data: await createListingMediaUploadTicket(request.auth.user, parseResult.data),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LISTING_NOT_FOUND") {
      return response.status(404).json({
        success: false,
        error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
      });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You cannot upload media for this listing." },
      });
    }
    throw error;
  }
});

mediaRouter.patch("/assets/:assetId", requireAuth, async (request, response) => {
  const parseResult = finalizeMediaSchema.safeParse(request.body ?? {});
  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEDIA_FINALIZE_REQUEST",
        message: "A valid media finalize request is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const updated = await completeListingMediaUpload(String(request.params.assetId), request.auth.user, parseResult.data);
  if (!updated) {
    return response.status(404).json({
      success: false,
      error: { code: "MEDIA_ASSET_NOT_FOUND", message: "Media asset not found." },
    });
  }

  return response.json({
    success: true,
    data: updated,
  });
});

mediaRouter.get("/listing/:listingId", async (request, response) => {
  return response.json({
    success: true,
    data: await listMediaAssetsForListing(String(request.params.listingId), request.auth.user ?? undefined),
  });
});

mediaRouter.delete("/assets/:assetId", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const deleted = await deleteListingMediaAsset(String(request.params.assetId), request.auth.user);
  if (!deleted) {
    return response.status(404).json({
      success: false,
      error: { code: "MEDIA_ASSET_NOT_FOUND", message: "Media asset not found." },
    });
  }

  return response.status(204).send();
});
