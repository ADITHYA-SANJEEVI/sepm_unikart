"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, PageHeader, Surface } from "@/components/system/primitives";
import { apiFetch, downloadApiFile } from "@/lib/api";

const faqItems = [
  {
    question: "How should payments be handled safely?",
    answer: "Inspect items in person, avoid rushed advance payments, and use the on-platform chat for all coordination.",
  },
  {
    question: "What if a seller or buyer feels suspicious?",
    answer: "Report the listing or thread in context, block the user if needed, and follow the safety guide before continuing.",
  },
  {
    question: "How should campus meetups work?",
    answer: "Prefer visible campus locations, confirm timing in chat, and ensure the meetup is tied to the actual listing.",
  },
];

export function V2PolicyPage() {
  const { auth } = useV2AppState();
  const [policies, setPolicies] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/policies", auth)
      .then((response) => setPolicies(response.data || []))
      .catch(() => setPolicies([]));
  }, [auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Safety"
        title="Safety guidance for payments, meetups, and suspicious behavior."
        description="Core safety rules."
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await downloadApiFile("/policies/export-pdf", auth, "unikart-safety-guide.pdf");
                setMessage("Safety guide downloaded.");
              } catch (error) {
                setMessage(error.message || "Could not download the safety guide.");
              }
            }}
          >
            Download safety guide
          </Button>
        }
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-dashboard-grid">
        <Surface title="Before you meet" description="The baseline rules every student should be able to skim in under a minute.">
          <div className="v2-checklist">
            <span>Prefer visible campus handoff points.</span>
            <span>Inspect the item before paying whenever possible.</span>
            <span>Use the built-in chat for all transaction coordination.</span>
            <span>Be careful with urgent advance payment requests and off-platform pressure.</span>
          </div>
        </Surface>

        <Surface title="Need help fast?" description="Open the right place quickly when a deal starts feeling off.">
          <div className="v2-utility-grid">
            <Link href="/support" className="v2-tool-link">
              <strong>Support</strong>
              <span>Escalation paths and account safety tools.</span>
            </Link>
            <Link href="/messages" className="v2-tool-link">
              <strong>Messages</strong>
              <span>Return to the listing-linked thread.</span>
            </Link>
            <Link href="/marketplace" className="v2-tool-link">
              <strong>Browse</strong>
              <span>Continue with stronger context.</span>
            </Link>
            <Link href="/notifications" className="v2-tool-link">
              <strong>Alerts</strong>
              <span>Review transaction changes and safety reminders.</span>
            </Link>
          </div>
        </Surface>
      </div>

      <Surface title="Policy library" description="Pulled directly from the backend so the safety layer stays current.">
        {policies.length ? (
          <div className="v2-inline-list">
            {policies.map((policy) => (
              <div key={policy.id} className="v2-inline-row">
                <div>
                  <strong>{policy.title}</strong>
                  <span>{policy.summary}</span>
                </div>
                <small>{policy.category}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock title="No safety articles loaded" description="Policy content could not be retrieved right now." />
        )}
      </Surface>

      <Surface title="Frequently asked questions" description="Short practical answers are often more useful than long policy prose.">
        <div className="v2-inline-list">
          {faqItems.map((item) => (
            <div key={item.question} className="v2-inline-row">
              <div>
                <strong>{item.question}</strong>
                <span>{item.answer}</span>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}
