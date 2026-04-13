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

export async function downloadListingPdfFallback(listing) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toPdfText(listing?.title || "UniKart Listing"));
  pdf.setCreator("UniKart");
  pdf.setProducer("UniKart");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const { page } = createPdfPage(pdf);
  let y = drawPdfHeader(page, fonts, 799, {
    eyebrow: "Listing export",
    title: listing?.title || "UniKart Listing",
    subtitle: "A structured listing packet with price, condition, seller context, and handoff guidance.",
    metaLine: `Prepared ${new Date().toLocaleString("en-IN")}`,
  });

  y = drawPdfFactGrid(page, fonts, y, [
    { label: "Price", value: formatPdfCurrency(listing?.price) },
    { label: "Seller", value: listing?.seller?.fullName || "Campus seller" },
    { label: "Condition", value: String(listing?.condition || "good").replaceAll("_", " ") },
    { label: "Area", value: listing?.area || "Campus" },
    { label: "Trust", value: `${listing?.trustScore ?? 40}/100` },
    { label: "Availability", value: `${listing?.inventoryCount || 1} item(s)` },
  ], 2);

  y = drawPdfSection(page, fonts, y, {
    title: "Seller snapshot",
    summary: listing?.seller?.sellerHeadline || listing?.seller?.bio || "Campus seller with in-app coordination and visible meetup guidance.",
    lines: [
      `Status: ${listing?.status || "active"}`,
      `Mode: ${listing?.mode || "sale"}`,
      `Meetup notes: ${listing?.listingMetadata?.meetupNotes || listing?.seller?.preferredMeetupSpot || "Confirm in chat"}`,
    ],
    tone: "brand",
  });

  y = drawPdfSection(page, fonts, y, {
    title: "Description",
    summary: listing?.description || "No description provided.",
    lines: [
      `Included items: ${listing?.listingMetadata?.includedItems || "Not specified"}`,
      `Usage highlights: ${listing?.listingMetadata?.usageHighlights || "Not specified"}`,
      `Fulfillment: ${(listing?.fulfillmentModes || []).join(", ") || "meetup"}`,
    ],
    tone: "neutral",
  });

  drawPdfSection(page, fonts, y, {
    title: "Safety reminders",
    summary: "Use these checks before paying, meeting, or moving the conversation off-platform.",
    lines: [
      "Inspect the item before payment.",
      "Prefer visible campus meetup points.",
      "Keep price, timing, and handoff details inside UniKart chat.",
    ],
    tone: "warning",
  });

  drawPdfFooter(page, fonts, "UniKart listing export", "Page 1 / 1");

  const bytes = await pdf.save();
  const fileName = `unikart-listing-${listing?.id || "export"}.pdf`;
  savePdfBlob(bytes, fileName);
  return fileName;
}
