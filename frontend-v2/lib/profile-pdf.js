"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  createPdfPage,
  drawPdfFactGrid,
  drawPdfFooter,
  drawPdfHeader,
  drawPdfSection,
  formatPdfCurrency,
  savePdfBlob,
  toPdfText,
} from "@/lib/pdf-fallback-utils";

export async function downloadProfilePdfFallback({ profile, listings = [], analytics = null }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toPdfText(profile?.fullName || "UniKart Profile"));
  pdf.setCreator("UniKart");
  pdf.setProducer("UniKart");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const listingCount = listings.length;
  const trustAverage = listingCount
    ? Math.round(listings.reduce((sum, item) => sum + Number(item.trustScore || 40), 0) / listingCount)
    : 40;
  const topListing = analytics?.seller?.listingBreakdown?.[0];

  const { page } = createPdfPage(pdf);
  let y = drawPdfHeader(page, fonts, 799, {
    eyebrow: "Seller profile",
    title: profile?.fullName || "UniKart seller",
    subtitle: profile?.sellerHeadline || profile?.bio || "Campus marketplace seller profile and trust summary.",
    metaLine: `Prepared ${new Date().toLocaleString("en-IN")}`,
  });

  y = drawPdfFactGrid(page, fonts, y, [
    { label: "Campus", value: profile?.campusId || "Campus" },
    { label: "Meetup default", value: profile?.preferredMeetupSpot || "Not set" },
    { label: "Listings", value: String(listingCount) },
    { label: "Average trust", value: `${trustAverage}/100` },
  ], 2);

  y = drawPdfSection(page, fonts, y, {
    title: "Trust snapshot",
    summary: "A compact trust overview buyers can use before messaging or comparing listings.",
    lines: [
      `Verified profile: ${profile?.isVerified ? "Yes" : "No"}`,
      `Response profile: ${profile?.responseReliability || "new"}`,
      `Profile completion: ${profile?.profileCompleteness ?? 40}%`,
      `Favorite categories: ${(profile?.favoriteCategories || []).join(", ") || "Not set"}`,
    ],
    tone: "brand",
  });

  y = drawPdfSection(page, fonts, y, {
    title: "Listing activity",
    summary: topListing ? `${topListing.title} is the strongest current activity signal.` : "Detailed listing analytics are not available in the current session.",
    lines: topListing
      ? [
          `${topListing.favoriteCount} saves`,
          `${topListing.conversationCount} chats`,
          `${topListing.scheduleCount} meetup plans`,
        ]
      : ["No listing activity snapshot available."],
    tone: "success",
  });

  drawPdfSection(page, fonts, y, {
    title: "Recent listings",
    summary: listings.length ? "Recent live or recent seller inventory." : "No public listings are visible for this seller right now.",
    lines: listings.length
      ? listings.slice(0, 5).map((item) => {
          const price = item.mode === "rent" && item.rentDetails?.dailyRate
            ? `${formatPdfCurrency(item.rentDetails.dailyRate)}/day`
            : formatPdfCurrency(item.price);
          return `${item.title} | ${price} | ${item.status || "active"} | ${item.area || "Campus"}`;
        })
      : ["No public listings available."],
    tone: "neutral",
  });

  drawPdfFooter(page, fonts, "UniKart seller profile export", "Page 1 / 1");

  const bytes = await pdf.save();
  const fileName = `unikart-seller-${profile?.id || "export"}.pdf`;
  savePdfBlob(bytes, fileName);
  return fileName;
}
