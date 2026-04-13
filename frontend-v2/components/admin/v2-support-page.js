"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, PageHeader, Surface } from "@/components/system/primitives";
import { apiFetch, downloadApiFile } from "@/lib/api";
import { downloadSupportPdfFallback } from "@/lib/support-pdf";

export function V2SupportPage() {
  const { auth, signedInLike } = useV2AppState();
  const [policies, setPolicies] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [assistantReply, setAssistantReply] = useState(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/policies", auth).catch(() => ({ data: [] })),
      signedInLike ? apiFetch("/users/blocked", auth).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]).then(([policyResponse, blockedResponse]) => {
      setPolicies(policyResponse.data || []);
      setBlockedUsers(blockedResponse.data || []);
    });
  }, [signedInLike, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  async function downloadSupportPacket() {
    try {
      try {
        await downloadApiFile("/users/support/export-pdf", auth, "unikart-support-packet.pdf");
      } catch {
        await downloadSupportPdfFallback({
          profile: auth.profile,
          blockedUsers,
          policies,
        });
      }
      setMessage("Support packet downloaded.");
    } catch (error) {
      setMessage(error.message || "Could not download support packet.");
    }
  }

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function askSafetyAssistant(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setAssistantBusy(true);
    try {
      const [aiResponse, policyResponse] = await Promise.all([
        apiFetch("/ai/search-assist", auth, {
          method: "POST",
          body: { query: question.trim() },
        }).catch(() => ({ data: null })),
        apiFetch("/policies", auth, { cacheMs: 60000 }).catch(() => ({ data: [] })),
      ]);

      const nextPolicies = policyResponse.data || [];
      const needle = question.trim().toLowerCase();
      const matches = nextPolicies.filter((item) =>
        `${item.title || ""} ${item.summary || ""} ${item.category || ""}`.toLowerCase().includes(needle),
      ).slice(0, 3);

      setPolicies(nextPolicies);
      setAssistantReply({
        summary:
          aiResponse.data?.guidance ||
          aiResponse.data?.rewrittenQuery ||
          aiResponse.data?.query ||
          "Review the guidance below and keep coordination inside the app.",
        aiMeta: [aiResponse.data?.suggestedCategory, aiResponse.data?.suggestedMode].filter(Boolean).join(" / "),
        matches,
      });
    } catch (error) {
      setMessage(error.message || "Could not load safety guidance.");
    } finally {
      setAssistantBusy(false);
    }
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Support"
        title="Get help quickly when a transaction needs backup."
        description="Use support, safety, and escalation tools without losing your place in the app."
        actions={signedInLike ? <Button variant="secondary" onClick={downloadSupportPacket}>Download support packet</Button> : null}
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-metric-grid">
        <MetricTile label="Blocked users" value={blockedUsers.length} detail="safety actions remembered in account" tone="safety" />
        <MetricTile label="Safety articles" value={policies.length} detail="linked policy references" tone="buying" />
        <MetricTile label="Escalation paths" value="4" detail="support routes surfaced directly here" tone="neutral" />
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="What to do first" description="Use these steps when a transaction starts feeling risky.">
          <div className="v2-checklist">
            <span>Report suspicious listings or abusive threads in context so moderation gets the actual evidence trail.</span>
            <span>Use on-platform chat to securely coordinate meetups.</span>
            <span>Block repeat offenders as soon as a pattern is clear.</span>
            <span>Prefer visible campus meetup points and inspect the item before money changes hands.</span>
          </div>
        </Surface>

        <Surface title="Quick routes" description="Jump back into the right workflow without hunting through the app.">
          <div className="v2-utility-grid">
            <Link href="/policy" className="v2-tool-link">
              <strong>Safety guide</strong>
              <span>Meetups, payment caution, and policy details.</span>
            </Link>
            <Link href="/messages" className="v2-tool-link">
              <strong>Messages</strong>
              <span>Return to the listing-linked thread with evidence intact.</span>
            </Link>
            <Link href="/notifications" className="v2-tool-link">
              <strong>Notifications</strong>
              <span>Review risk alerts, hold updates, and selling changes.</span>
            </Link>
            <Link href="/marketplace" className="v2-tool-link">
              <strong>Browse</strong>
              <span>Return to the marketplace without losing context.</span>
            </Link>
          </div>
        </Surface>
      </div>

      <Surface title="Safety assistant" description="Ask a safety question and get the closest guidance from the app's policy library.">
        <form className="v2-field-stack" onSubmit={askSafetyAssistant}>
          <label className="v2-field">
            <span>Question</span>
            <textarea
              rows={3}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Can I share my phone number? What should I do if a seller asks for advance payment?"
            />
          </label>
          <div className="v2-page-header-actions">
            <Button type="submit" disabled={assistantBusy || !question.trim()}>
              {assistantBusy ? "Checking..." : "Ask safety assistant"}
            </Button>
          </div>
        </form>

        {assistantReply ? (
          <div className="v2-inline-list">
            <div className="v2-inline-row">
              <div>
                <strong>Suggested direction</strong>
                <span>{assistantReply.summary}</span>
              </div>
              {assistantReply.aiMeta ? <small>{assistantReply.aiMeta}</small> : null}
            </div>
            {assistantReply.matches.length ? assistantReply.matches.map((item) => (
              <Link key={item.id} href="/policy" className="v2-link-row">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.summary}</span>
                </div>
                <small>{item.category}</small>
              </Link>
            )) : null}
          </div>
        ) : null}
      </Surface>

      <div className="v2-dashboard-grid">
        <Surface title="Blocked users" description="Blocked accounts stay visible here so you can review and manage them easily.">
          {blockedUsers.length ? (
            <div className="v2-inline-list">
              {blockedUsers.map((item) => (
                <div key={item.id} className="v2-inline-row">
                  <div>
                    <strong>{item.blockedProfile?.fullName || item.blockedProfileId}</strong>
                    <span>Blocked from direct interaction in the current account.</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No blocked users" description="Blocked users will appear here after a safety or support action is taken." />
          )}
        </Surface>

        <Surface title="Support library" description="Review the latest safety articles and support guidance in one place.">
          {policies.length ? (
            <div className="v2-inline-list">
              {policies.map((policy) => (
                <Link key={policy.id} href="/policy" className="v2-link-row">
                  <div>
                    <strong>{policy.title}</strong>
                    <span>{policy.summary}</span>
                  </div>
                  <small>{policy.category}</small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No support articles loaded" description="Support guidance will show here once the policy library responds." />
          )}
        </Surface>
      </div>
    </div>
  );
}
