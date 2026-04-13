import { Router } from "express";
import { z } from "zod";

import {
  archiveListing,
  compareListings,
  createListing,
  createOffer,
  duplicateListing,
  favoriteListing,
  getListingById,
  getSellerProfileForListing,
  listCompareQueue,
  listHoldsForListing,
  listListings,
  listOffersForListing,
  listFavoriteListings,
  listSimilarListings,
  listOwnListings,
  listPolicies,
  reportListing,
  requestListingHold,
  relistListing,
  markListingSold,
  unfavoriteListing,
  updateHoldStatus,
  updateOfferStatus,
  updateListing,
  deleteListing,
} from "../services/platform.service";
import { requireAuth } from "../middleware/auth.middleware";
import { createUniKartPdf } from "../lib/formatted-pdf";

export const listingsRouter = Router();

const listingQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z
    .enum([
      "electronics",
      "books",
      "hostel-essentials",
      "cycle",
      "furniture",
      "fashion",
      "appliances",
      "lab-equipment",
    ])
    .optional(),
  condition: z.enum(["like_new", "good", "fair"]).optional(),
  status: z.enum(["draft", "active", "reserved", "sold", "hidden", "suspended"]).optional(),
  mode: z.enum(["sale", "rent", "bundle"]).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  deliveryAvailable: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  negotiableOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().positive().max(120).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "trust_desc"]).optional(),
});

const listingWriteBaseSchema = z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(2000),
    price: z.number().nonnegative(),
    inventoryCount: z.number().int().positive().max(999).optional(),
    category: z.enum([
      "electronics",
      "books",
      "hostel-essentials",
      "cycle",
      "furniture",
      "fashion",
      "appliances",
      "lab-equipment",
    ]),
    condition: z.enum(["like_new", "good", "fair"]),
    negotiable: z.boolean(),
    fulfillmentModes: z
      .array(z.enum(["meetup", "pickup", "campus-drop", "hostel-meetup"]))
      .min(1)
      .max(4),
    area: z.string().trim().min(2).max(120),
    imageUrls: z.array(z.string().trim().min(1)).max(7),
    mediaAssetIds: z.array(z.string().trim().min(1)).max(7).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10),
    status: z.enum(["draft", "active", "reserved", "sold", "hidden", "suspended"]).optional(),
    mode: z.enum(["sale", "rent", "bundle"]).optional(),
    rentDetails: z
      .object({
        dailyRate: z.number().nonnegative().optional(),
        weeklyRate: z.number().nonnegative().optional(),
        deposit: z.number().nonnegative().optional(),
        minDurationDays: z.number().int().positive().optional(),
        availabilitySummary: z.string().trim().max(200).optional(),
      })
      .optional(),
    bundleDetails: z
      .object({
        itemCount: z.number().int().positive().optional(),
        summary: z.string().trim().max(240).optional(),
      })
      .optional(),
    listingMetadata: z
      .object({
        brand: z.string().trim().max(120).optional(),
        originalPrice: z.number().nonnegative().optional(),
        ageMonths: z.number().int().nonnegative().optional(),
        reasonForSelling: z.string().trim().max(300).optional(),
        includedItems: z.string().trim().max(300).optional(),
        meetupNotes: z.string().trim().max(300).optional(),
        usageHighlights: z.string().trim().max(300).optional(),
        preferredContactWindow: z.string().trim().max(120).optional(),
        exactLocationHint: z.string().trim().max(160).optional(),
      })
      .optional(),
  });

const listingWriteSchema = listingWriteBaseSchema.superRefine((value, context) => {
    const imageCount = value.imageUrls?.length ?? 0;
    const mediaCount = value.mediaAssetIds?.length ?? 0;
    if (imageCount + mediaCount < 1) {
      context.addIssue({
        code: "custom",
        path: ["imageUrls"],
        message: "Provide at least one image URL or uploaded media asset.",
      });
    }
  });

const listingUpdateSchema = listingWriteBaseSchema.partial();

const listingReportSchema = z.object({
  reason: z.enum([
    "fraudulent_listing",
    "fake_seller",
    "abusive_chat",
    "suspicious_payment_request",
    "prohibited_item",
    "harassment",
    "impersonation",
  ]),
  details: z.string().trim().max(1000).optional(),
});

const compareQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .optional(),
});

const holdCreateSchema = z.object({
  hours: z.number().int().min(1).max(72).optional(),
  note: z.string().trim().max(300).optional(),
});

const holdUpdateSchema = z.object({
  status: z.enum(["released", "converted"]),
  note: z.string().trim().max(300).optional(),
});

const offerCreateSchema = z.object({
  amount: z.number().nonnegative(),
  note: z.string().trim().max(500).optional(),
  previousOfferId: z.string().trim().optional(),
  expiresInHours: z.number().int().min(1).max(72).optional(),
});

const offerUpdateSchema = z.object({
  status: z.enum(["accepted", "rejected", "withdrawn"]),
  note: z.string().trim().max(500).optional(),
});

listingsRouter.get("/", async (request, response) => {
  const parseResult = listingQuerySchema.safeParse(request.query);

  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_LISTING_QUERY",
        message: "Invalid listing query parameters.",
        details: parseResult.error.flatten(),
      },
    });
  }

  return response.json({
    success: true,
    data: await listListings(parseResult.data, request.auth.user ?? undefined),
  });
});

listingsRouter.get("/compare", async (request, response) => {
  const parseResult = compareQuerySchema.safeParse(request.query);

  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_COMPARE_QUERY",
        message: "A valid compare query is required.",
        details: parseResult.error.flatten(),
      },
    });
  }

  const compareIds =
    parseResult.data.ids && parseResult.data.ids.length
      ? parseResult.data.ids
      : request.auth.user
        ? (await listCompareQueue(request.auth.user)).map((item) => item.listingId)
        : [];

  return response.json({
    success: true,
    data: compareIds.length ? await compareListings(compareIds, request.auth.user ?? undefined) : [],
  });
});

listingsRouter.get("/mine", requireAuth, async (request, response) => {
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
    data: await listOwnListings(request.auth.user),
  });
});

listingsRouter.get("/favorites", requireAuth, async (request, response) => {
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
    data: await listFavoriteListings(request.auth.user),
  });
});

listingsRouter.get("/:listingId", async (request, response) => {
  const listingId = String(request.params.listingId);
  const listing = await getListingById(listingId, request.auth.user ?? undefined);

  if (!listing) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: listing,
  });
});

listingsRouter.get("/:listingId/similar", async (request, response) => {
  return response.json({
    success: true,
    data: await listSimilarListings(String(request.params.listingId), request.auth.user ?? undefined),
  });
});

listingsRouter.get("/:listingId/seller", async (request, response) => {
  const listingId = String(request.params.listingId);
  const seller = await getSellerProfileForListing(listingId);

  if (!seller) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: seller,
  });
});

listingsRouter.get("/:listingId/export-pdf", async (request, response) => {
  const listingId = String(request.params.listingId);
  const listing = await getListingById(listingId, request.auth.user ?? undefined);

  if (!listing) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  const policies = await listPolicies();
  const pdf = await createUniKartPdf({
    eyebrow: "Listing export",
    title: "UniKart Listing Packet",
    subtitle: "A formatted listing packet for buyers, including key pricing details, seller trust context, and campus safety guidance.",
    meta: [
      { label: "Listing", value: listing.title },
      { label: "Seller", value: listing.seller?.fullName || "Campus Seller" },
      { label: "Price", value: `Rs. ${listing.price}` },
      { label: "Status", value: listing.status },
    ],
    sections: [
      {
        title: "Listing details",
        facts: [
          { label: "Category", value: listing.category },
          { label: "Mode", value: listing.mode || "sale" },
          { label: "Condition", value: listing.condition },
          { label: "Area", value: listing.area },
          { label: "Units", value: String(listing.inventoryCount || 1) },
          { label: "Updated", value: new Date(listing.updatedAt || listing.createdAt).toLocaleString("en-IN") },
        ],
        paragraphs: [listing.description],
        tone: "brand",
      },
      {
        title: "Seller trust",
        facts: [
          { label: "Verified", value: listing.seller?.isVerified ? "Yes" : "No" },
          { label: "Response", value: listing.seller?.responseReliability || "new" },
          { label: "Meetup", value: listing.seller?.preferredMeetupSpot || listing.listingMetadata?.meetupNotes || "Confirm in chat" },
          { label: "Trust score", value: `${listing.trustScore}/100` },
        ],
        summary: "Use the seller context below before making payment or committing to a meetup.",
      },
      {
        title: "Safety guidance",
        summary: "Keep these rules visible while you negotiate, compare, or arrange a meetup.",
        bullets: policies.map((policy) => `${policy.title}: ${policy.summary}`),
        tone: "warning",
      },
    ],
    footerNote: "UniKart listing export",
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=\"unikart-listing-${listing.id}.pdf\"`);
  return response.send(pdf);
});

listingsRouter.post("/", requireAuth, async (request, response) => {
  const parseResult = listingWriteSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_LISTING",
        message: "A valid listing payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: await createListing(parseResult.data, request.auth.user),
  });
});

listingsRouter.patch("/:listingId", requireAuth, async (request, response) => {
  const parseResult = listingUpdateSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_LISTING_UPDATE",
        message: "A valid listing update payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  try {
    const listingId = String(request.params.listingId);
    const updated = await updateListing(listingId, parseResult.data, request.auth.user);

    if (!updated) {
      return response.status(404).json({
        success: false,
        error: {
          code: "LISTING_NOT_FOUND",
          message: "Listing not found.",
        },
      });
    }

    return response.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You cannot edit this listing.",
        },
      });
    }

    throw error;
  }
});

listingsRouter.post("/:listingId/archive", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  try {
    const archived = await archiveListing(String(request.params.listingId), request.auth.user);
    if (!archived) {
      return response.status(404).json({
        success: false,
        error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
      });
    }
    return response.json({ success: true, data: archived });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You cannot archive this listing." },
      });
    }
    throw error;
  }
});

listingsRouter.post("/:listingId/mark-sold", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  try {
    const updated = await markListingSold(String(request.params.listingId), request.auth.user);
    if (!updated) {
      return response.status(404).json({
        success: false,
        error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
      });
    }
    return response.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You cannot mark this listing sold." },
      });
    }
    throw error;
  }
});

listingsRouter.post("/:listingId/relist", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  try {
    const updated = await relistListing(String(request.params.listingId), request.auth.user);
    if (!updated) {
      return response.status(404).json({
        success: false,
        error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
      });
    }
    return response.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You cannot relist this listing." },
      });
    }
    throw error;
  }
});

listingsRouter.post("/:listingId/duplicate", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  try {
    const duplicated = await duplicateListing(String(request.params.listingId), request.auth.user);
    if (!duplicated) {
      return response.status(404).json({
        success: false,
        error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
      });
    }
    return response.status(201).json({ success: true, data: duplicated });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You cannot duplicate this listing." },
      });
    }
    throw error;
  }
});

listingsRouter.get("/:listingId/offers", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listOffersForListing(String(request.params.listingId), request.auth.user),
  });
});

listingsRouter.post("/:listingId/offers", requireAuth, async (request, response) => {
  const parseResult = offerCreateSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_OFFER",
        message: "A valid offer payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const result = await createOffer(String(request.params.listingId), request.auth.user, parseResult.data);
  if (!result) {
    return response.status(404).json({
      success: false,
      error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
    });
  }
  if ("error" in result) {
    const codeMap = {
      LISTING_NOT_FOUND: 404,
      SELF_OFFER: 400,
      BLOCKED: 403,
      INVALID_COUNTER: 400,
      THREAD_CLOSED: 409,
    } as const;
    return response.status(codeMap[result.error] ?? 400).json({
      success: false,
      error: {
        code: result.error,
        message:
          result.error === "BLOCKED"
            ? "Negotiation is blocked between these users."
            : result.error === "THREAD_CLOSED"
              ? "This thread has been terminated and can no longer accept offers."
            : result.error === "INVALID_COUNTER"
              ? "Sellers can only create counter-offers in reply to an existing offer."
              : "Offer could not be created.",
      },
    });
  }

  return response.status(201).json({ success: true, data: result });
});

listingsRouter.patch("/offers/:offerId", requireAuth, async (request, response) => {
  const parseResult = offerUpdateSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_OFFER_UPDATE",
        message: "A valid offer update payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const result = await updateOfferStatus(String(request.params.offerId), request.auth.user, parseResult.data);
  if (!result) {
    return response.status(404).json({
      success: false,
      error: { code: "OFFER_NOT_FOUND", message: "Offer not found." },
    });
  }
  if ("error" in result) {
    return response.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "You cannot update this offer." },
    });
  }

  return response.json({ success: true, data: result });
});

listingsRouter.get("/:listingId/holds", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listHoldsForListing(String(request.params.listingId), request.auth.user),
  });
});

listingsRouter.post("/:listingId/holds", requireAuth, async (request, response) => {
  const parseResult = holdCreateSchema.safeParse(request.body ?? {});

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_HOLD_REQUEST",
        message: "A valid hold request is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const result = await requestListingHold(String(request.params.listingId), request.auth.user, parseResult.data);
  if (!result) {
    return response.status(404).json({
      success: false,
      error: { code: "LISTING_NOT_FOUND", message: "Listing not found." },
    });
  }
  if ("error" in result) {
    const codeMap = {
      LISTING_UNAVAILABLE: 400,
      SELF_HOLD: 400,
      BLOCKED: 403,
    } as const;
    return response.status(codeMap[result.error] ?? 400).json({
      success: false,
      error: {
        code: result.error,
        message:
          result.error === "LISTING_UNAVAILABLE"
            ? "This listing is not available for a soft hold."
            : result.error === "BLOCKED"
              ? "Holds are blocked between these users."
              : "You cannot create a hold for your own listing.",
      },
    });
  }

  return response.status(201).json({ success: true, data: result });
});

listingsRouter.patch("/holds/:holdId", requireAuth, async (request, response) => {
  const parseResult = holdUpdateSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_HOLD_UPDATE",
        message: "A valid hold update is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const result = await updateHoldStatus(String(request.params.holdId), request.auth.user, parseResult.data);
  if (!result) {
    return response.status(404).json({
      success: false,
      error: { code: "HOLD_NOT_FOUND", message: "Hold not found." },
    });
  }
  if ("error" in result) {
    return response.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "You cannot update this hold." },
    });
  }

  return response.json({ success: true, data: result });
});

listingsRouter.delete("/:listingId", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  try {
    const listingId = String(request.params.listingId);
    const deleted = await deleteListing(listingId, request.auth.user);

    if (!deleted) {
      return response.status(404).json({
        success: false,
        error: {
          code: "LISTING_NOT_FOUND",
          message: "Listing not found.",
        },
      });
    }

    return response.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return response.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You cannot delete this listing.",
        },
      });
    }

    throw error;
  }
});

listingsRouter.post("/:listingId/favorite", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const listingId = String(request.params.listingId);
  const favorite = await favoriteListing(listingId, request.auth.user);

  if (!favorite) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: favorite,
  });
});

listingsRouter.delete("/:listingId/favorite", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const listingId = String(request.params.listingId);
  const removed = await unfavoriteListing(listingId, request.auth.user);

  if (!removed) {
    return response.status(404).json({
      success: false,
      error: {
        code: "FAVORITE_NOT_FOUND",
        message: "Favorite not found for this listing.",
      },
    });
  }

  return response.status(204).send();
});

listingsRouter.post("/:listingId/report", requireAuth, async (request, response) => {
  const parseResult = listingReportSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_REPORT",
        message: "A valid report payload is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const report = await reportListing(
    String(request.params.listingId),
    request.auth.user,
    parseResult.data.reason,
    parseResult.data.details,
  );

  if (!report) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: report,
  });
});
