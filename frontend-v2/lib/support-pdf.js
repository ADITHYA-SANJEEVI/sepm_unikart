"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  createPdfPage,
  drawPdfFactGrid,
  drawPdfFooter,
  drawPdfHeader,
  drawPdfSection,
  savePdfBlob,
  toPdfText,
} from "@/lib/pdf-fallback-utils";

export async function downloadSupportPdfFallback({ profile, blockedUsers = [], policies = [] }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toPdfText(profile?.fullName || "UniKart Support Packet"));
  pdf.setCreator("UniKart");
  pdf.setProducer("UniKart");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  const { page } = createPdfPage(pdf);
  let y = drawPdfHeader(page, fonts, 799, {
    eyebrow: "Support packet",
    title: profile?.fullName || "UniKart account",
    subtitle: "A support and safety packet covering escalation steps, blocked users, and policy references.",
    metaLine: `Prepared ${new Date().toLocaleString("en-IN")}`,
  });

  y = drawPdfFactGrid(page, fonts, y, [
    { label: "Campus", value: profile?.campusId || "Campus" },
    { label: "Meetup preference", value: profile?.preferredMeetupSpot || "Confirm in chat" },
    { label: "Safety alerts", value: profile?.notificationPreferences?.safety ? "Enabled" : "Not configured" },
    { label: "Blocked users", value: String(blockedUsers.length) },
  ], 2);

  y = drawPdfSection(page, fonts, y, {
    title: "Escalation reminders",
    summary: "Use these steps when a listing, chat, or meetup starts to feel unsafe or manipulative.",
    lines: [
      "Report suspicious listings or abusive chat inside the related UniKart flow.",
      "Block repeat offenders quickly so the account remembers the safety boundary.",
      "Prefer visible campus meetup spots and inspect the item before payment.",
    ],
    tone: "warning",
  });

  y = drawPdfSection(page, fonts, y, {
    title: "Blocked users",
    summary: blockedUsers.length ? "These profiles are currently blocked from your side." : "No blocked users are currently on record.",
    lines: blockedUsers.length
      ? blockedUsers.slice(0, 6).map((item) => item.blockedProfile?.fullName || item.blockedProfileId || "Blocked account")
      : ["No blocked users on record."],
    tone: blockedUsers.length ? "danger" : "neutral",
  });

  drawPdfSection(page, fonts, y, {
    title: "Policy quick references",
    summary: "Use these references when deciding whether to continue a conversation, meetup, or payment.",
    lines: policies.length
      ? policies.slice(0, 5).map((item) => `${item.title}: ${item.summary}`)
      : ["Policy guidance is unavailable in the current session."],
    tone: "brand",
  });

  drawPdfFooter(page, fonts, "UniKart support and safety packet", "Page 1 / 1");

  const bytes = await pdf.save();
  const fileName = "unikart-support-packet.pdf";
  savePdfBlob(bytes, fileName);
  return fileName;
}
