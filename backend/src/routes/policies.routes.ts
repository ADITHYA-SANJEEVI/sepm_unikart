import { Router } from "express";

import { createUniKartPdf } from "../lib/formatted-pdf";
import { listPolicies } from "../services/platform.service";

export const policiesRouter = Router();

policiesRouter.get("/", async (_request, response) => {
  return response.json({
    success: true,
    data: await listPolicies(),
  });
});

policiesRouter.get("/export-pdf", async (_request, response) => {
  const policies = await listPolicies();
  const pdf = await createUniKartPdf({
    eyebrow: "Safety packet",
    title: "UniKart Safety and Policy Guide",
    subtitle: "A formatted campus safety guide for meetups, payments, reporting, and responsible listing behavior.",
    meta: [
      { label: "Articles", value: String(policies.length) },
      { label: "Use case", value: "Meetups, payments, and reporting" },
      { label: "Coordination", value: "Keep it inside UniKart chat" },
    ],
    sections: policies.map((policy) => ({
      title: policy.title,
      summary: policy.summary,
      bullets: policy.body,
      tone: policy.category === "meetups" ? "warning" : policy.category === "policy" ? "danger" : "brand",
    })),
    footerNote: "UniKart campus safety reference",
  });

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", 'attachment; filename="unikart-safety-guide.pdf"');
  return response.send(pdf);
});
