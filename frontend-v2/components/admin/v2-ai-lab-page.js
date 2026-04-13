"use client";

import { useEffect, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch } from "@/lib/api";

function JsonPreview({ value }) {
  if (!value) return null;
  return <pre className="v2-json-block">{JSON.stringify(value, null, 2)}</pre>;
}

export function V2AiLabPage() {
  const { auth, signedInLike } = useV2AppState();
  const [listingInput, setListingInput] = useState({
    title: "Used Hostel Kettle",
    description: "Works well for hostel tea and instant noodles. A few cosmetic marks but still reliable.",
    category: "hostel-essentials",
    price: 550,
  });
  const [chatMessage, setChatMessage] = useState("Send the money first and I will hold it for you.");
  const [searchQuery, setSearchQuery] = useState("used calculator under 800 near campus");
  const [results, setResults] = useState({});
  const [diagnostics, setDiagnostics] = useState(null);
  const [providerEvents, setProviderEvents] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const isAdmin = !!(auth.overrideSecret || auth.profile?.role === "admin" || auth.devRole === "admin");

  useEffect(() => {
    if (!signedInLike || !isAdmin) return;
    Promise.all([
      apiFetch("/admin/ai-diagnostics", auth).catch(() => ({ data: null })),
      apiFetch("/admin/ai-provider-events?limit=8", auth).catch(() => ({ data: [] })),
      apiFetch("/admin/ai-artifacts?limit=6", auth).catch(() => ({ data: [] })),
    ]).then(([diagnosticsResponse, providerResponse, artifactResponse]) => {
      setDiagnostics(diagnosticsResponse.data || null);
      setProviderEvents(providerResponse.data || []);
      setArtifacts(artifactResponse.data || []);
    });
  }, [signedInLike, isAdmin, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function run(path, body, key, method = "POST") {
    setBusy(key);
    try {
      const response = await apiFetch(path, auth, body ? { method, body } : { method });
      setResults((current) => ({ ...current, [key]: response.data }));
      const source = response.data?.source || response.data?.provider || "";
      setMessage(source ? `Response loaded from ${source}.` : "AI request completed.");
    } catch (error) {
      setMessage(error.message || "AI request failed.");
    } finally {
      setBusy("");
    }
  }

  if (!signedInLike) {
    return (
      <div className="v2-workspace-page">
        <PageHeader
          compact
          eyebrow="AI"
          title="Sign in to exercise AI tools against the real backend."
          description="Test the AI moderation and features."
        />
      </div>
    );
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="AI"
        title="Inspect assist quality, moderation behavior, and live provider health."
        description="Test listing help, search refinement, moderation checks, and provider health from one place."
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      {isAdmin ? (
        <div className="v2-metric-grid">
          <MetricTile label="Provider events" value={diagnostics?.totalRequests ?? 0} detail="recent AI activity" tone="admin" />
          <MetricTile label="Artifacts" value={artifacts.length} detail="stored outputs available to review" tone="buying" />
          <MetricTile label="Avg latency" value={diagnostics?.avgLatencyMs ?? 0} detail="average provider round trip in ms" tone="neutral" />
        </div>
      ) : null}

      <div className="v2-dashboard-grid">
        <Surface title="Listing assist" description="Test how AI improves structure, clarity, and category guidance for a real listing draft.">
          <div className="v2-field-stack">
            <label className="v2-field">
              <span>Title</span>
              <input value={listingInput.title} onChange={(event) => setListingInput((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <div className="v2-field-grid">
              <label className="v2-field">
                <span>Price</span>
                <input type="number" value={listingInput.price} onChange={(event) => setListingInput((current) => ({ ...current, price: Number(event.target.value) }))} />
              </label>
              <label className="v2-field">
                <span>Category</span>
                <input value={listingInput.category} onChange={(event) => setListingInput((current) => ({ ...current, category: event.target.value }))} />
              </label>
            </div>
            <label className="v2-field">
              <span>Description</span>
              <textarea rows={5} value={listingInput.description} onChange={(event) => setListingInput((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="v2-page-header-actions">
              <Button onClick={() => run("/ai/listing-assist", listingInput, "assist")} disabled={busy === "assist"}>{busy === "assist" ? "Running..." : "Run assist"}</Button>
              <Button variant="secondary" onClick={() => run("/ai/moderate/listing", listingInput, "listingModeration")} disabled={busy === "listingModeration"}>
                {busy === "listingModeration" ? "Checking..." : "Moderate listing"}
              </Button>
            </div>
          </div>

          {results.assist ? (
            <div className="v2-inline-list">
              <div className="v2-inline-row">
                <div>
                  <strong>{results.assist.improvedTitle || "Improved title unavailable"}</strong>
                  <span>{results.assist.source || "provider source not supplied"}</span>
                </div>
                <small>{results.assist.suggestedCategory || "no category shift"}</small>
              </div>
            </div>
          ) : null}
          <JsonPreview value={results.assist} />
          <JsonPreview value={results.listingModeration} />
        </Surface>

        <Surface title="Chat moderation" description="Use a realistic risky message to validate moderation flags and fallback behavior.">
          <div className="v2-field-stack">
            <label className="v2-field">
              <span>Message</span>
              <textarea rows={6} value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} />
            </label>
            <Button variant="secondary" onClick={() => run("/ai/moderate/chat", { message: chatMessage }, "chatModeration")} disabled={busy === "chatModeration"}>
              {busy === "chatModeration" ? "Analyzing..." : "Analyze chat risk"}
            </Button>
          </div>
          {results.chatModeration?.riskLevel ? (
            <div className="v2-stack-inline">
              <StatusPill tone={results.chatModeration.riskLevel === "high" ? "safety" : results.chatModeration.riskLevel === "medium" ? "selling" : "neutral"}>
                {results.chatModeration.riskLevel} risk
              </StatusPill>
              {results.chatModeration.source ? <StatusPill tone="buying">{results.chatModeration.source}</StatusPill> : null}
            </div>
          ) : null}
          <JsonPreview value={results.chatModeration} />
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Search assist" description="Use a realistic query to see how AI can refine or expand campus search intent.">
          <div className="v2-field-stack">
            <label className="v2-field">
              <span>Search query</span>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search query" />
            </label>
            <Button variant="secondary" onClick={() => run("/ai/search-assist", { query: searchQuery }, "searchAssist")} disabled={busy === "searchAssist"}>
              {busy === "searchAssist" ? "Refining..." : "Refine search"}
            </Button>
          </div>
          {results.searchAssist ? <JsonPreview value={results.searchAssist} /> : <EmptyBlock title="No search refinement yet" description="Run a real marketplace query to preview AI-assisted search suggestions." />}
        </Surface>

        {isAdmin ? (
          <Surface title="Provider health" description="Recent provider activity and recorded artifacts are visible here for admin sessions.">
            {providerEvents.length ? (
              <div className="v2-inline-list">
                {providerEvents.map((item) => (
                  <div key={item.id} className="v2-inline-row">
                    <div>
                      <strong>{item.operation || item.eventType || "AI event"}</strong>
                      <span>{item.provider || "provider"} / {item.status || "unknown"} / {item.usedFallback ? "backup path" : "live provider"}</span>
                    </div>
                    <small>{item.httpStatus || "-"}</small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No provider events yet" description="Provider activity will show here once the AI layer records it." />
            )}

            {artifacts.length ? (
              <div className="v2-inline-list">
                {artifacts.slice(0, 4).map((item) => (
                  <div key={item.id} className="v2-inline-row">
                    <div>
                      <strong>{item.artifactType || "artifact"}</strong>
                      <span>{item.provider || "provider"} / {item.model || "model unknown"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </Surface>
        ) : (
          <Surface title="Operator visibility" description="Admin-only provider diagnostics appear when an admin session is active.">
            <EmptyBlock title="Admin session required" description="Use the authentication page to apply an admin persona or override before checking provider diagnostics." />
          </Surface>
        )}
      </div>
    </div>
  );
}
