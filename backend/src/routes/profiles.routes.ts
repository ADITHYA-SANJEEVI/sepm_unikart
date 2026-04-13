import { Router } from "express";

import { profileUpdateSchema } from "../lib/profile-update-schema";
import { createUniKartPdf } from "../lib/formatted-pdf";
import { getOwnProfile, getPublicProfileById, listListingsBySeller, listPolicies, updateOwnProfile } from "../services/platform.service";
import { requireAuth } from "../middleware/auth.middleware";

export const profilesRouter = Router();

profilesRouter.get("/me", requireAuth, async (request, response) => {
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

profilesRouter.patch("/me", requireAuth, async (request, response) => {
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

profilesRouter.get("/:profileId", async (request, response) => {
  const profile = await getPublicProfileById(String(request.params.profileId));

  if (!profile) {
    return response.status(404).json({
      success: false,
      error: { code: "PROFILE_NOT_FOUND", message: "Profile not found." },
    });
  }

  return response.json({
    success: true,
    data: profile,
  });
});

profilesRouter.patch("/:profileId", requireAuth, async (request, response) => {
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

  const actorProfile = await getOwnProfile(request.auth.user);
  if (actorProfile.id !== String(request.params.profileId) && request.auth.user.role !== "admin") {
    return response.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "You cannot edit this profile." },
    });
  }

  return response.json({
    success: true,
    data: await updateOwnProfile(request.auth.user, parseResult.data),
  });
});

profilesRouter.get("/:profileId/listings", async (request, response) => {
  const listings = await listListingsBySeller(String(request.params.profileId), request.auth.user ?? undefined);

  return response.json({
    success: true,
    data: listings,
  });
});

profilesRouter.get("/:profileId/export-pdf", async (request, response) => {
  const profile = await getPublicProfileById(String(request.params.profileId));

  if (!profile) {
    return response.status(404).json({
      success: false,
      error: { code: "PROFILE_NOT_FOUND", message: "Profile not found." },
    });
  }

  const [listings, policies] = await Promise.all([
    listListingsBySeller(String(request.params.profileId), request.auth.user ?? undefined),
    listPolicies(),
  ]);

  const pdf = await createUniKartPdf({
    eyebrow: "Seller profile",
    title: "UniKart Seller Profile Packet",
    subtitle: "A formatted profile packet showing seller trust, recent listings, and the safety guidance buyers should keep in view.",
    meta: [
      { label: "Seller", value: profile.fullName },
      { label: "Campus", value: profile.campusId },
      { label: "Verified", value: profile.isVerified ? "Yes" : "No" },
      { label: "Listings", value: String(listings.length) },
    ],
    sections: [
      {
        title: "Seller trust snapshot",
        facts: [
          { label: "Response profile", value: profile.responseReliability },
          { label: "Meetup default", value: profile.preferredMeetupSpot || "Not set" },
          { label: "Favorite categories", value: (profile.favoriteCategories || []).join(", ") || "Not set" },
          { label: "Profile completion", value: `${profile.profileCompleteness ?? 0}%` },
        ],
        tone: "brand",
      },
      {
        title: "Recent listings",
        summary: listings.length ? "Recent live or recent seller inventory." : "No public listings are visible for this seller right now.",
        bullets: listings.length
          ? listings.slice(0, 6).map((listing) => `${listing.title} | ${listing.status} | Rs. ${listing.price} | ${listing.area}`)
          : ["No public listings available."],
      },
      {
        title: "Safety guidance",
        summary: "Keep these checks visible when you are about to message, compare, or meet this seller.",
        bullets: policies.map((policy) => `${policy.title}: ${policy.summary}`),
        tone: "warning",
      },
    ],
    footerNote: "UniKart seller profile export",
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename=\"unikart-seller-${profile.id}.pdf\"`);
  return response.send(pdf);
});
