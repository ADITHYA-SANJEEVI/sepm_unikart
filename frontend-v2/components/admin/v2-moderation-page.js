"use client";

import { useEffect, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { SelectField } from "@/components/system/select-field";
import { apiFetch, downloadApiFile } from "@/lib/api";

export function V2ModerationPage() {
  const { auth, signedInLike } = useV2AppState();
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [platformAnalytics, setPlatformAnalytics] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [providerEvents, setProviderEvents] = useState([]);
  const [reportId, setReportId] = useState("");
  const [action, setAction] = useState("warn_user");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = !!(auth.overrideSecret || auth.profile?.role === "admin" || auth.devRole === "admin");

  async function loadModeration() {
    const [reportResponse, actionResponse, analyticsResponse, platformResponse, diagnosticsResponse, providerResponse] = await Promise.all([
      apiFetch("/admin/reports", auth).catch(() => ({ data: [] })),
      apiFetch("/admin/moderation-actions", auth).catch(() => ({ data: [] })),
      apiFetch("/admin/analytics", auth).catch(() => ({ data: null })),
      apiFetch("/admin/platform-analytics", auth).catch(() => ({ data: null })),
      apiFetch("/admin/ai-diagnostics", auth).catch(() => ({ data: null })),
      apiFetch("/admin/ai-provider-events?limit=8", auth).catch(() => ({ data: [] })),
    ]);
    setReports(reportResponse.data || []);
    setActions(actionResponse.data || []);
    setAnalytics(analyticsResponse.data || null);
    setPlatformAnalytics(platformResponse.data || null);
    setDiagnostics(diagnosticsResponse.data || null);
    setProviderEvents(providerResponse.data || []);
  }

  useEffect(() => {
    if (!signedInLike || !isAdmin) return;
    loadModeration().catch(() => setMessage("Could not load moderation workspace."));
  }, [signedInLike, isAdmin, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function applyAction(event) {
    event.preventDefault();
    if (!reportId) return;
    setBusy("action");
    try {
      await apiFetch(`/admin/reports/${reportId}/actions`, auth, {
        method: "POST",
        body: { action, note: note || undefined },
      });
      setReportId("");
      setNote("");
      setMessage("Moderation action applied.");
      await loadModeration();
    } catch (error) {
      setMessage(error.message || "Could not apply moderation action.");
    } finally {
      setBusy("");
    }
  }

  async function exportReportPdf(id) {
    try {
      await downloadApiFile(`/admin/reports/${id}/export-pdf`, auth, `unikart-report-${id}.pdf`);
      setMessage("Evidence packet downloaded.");
    } catch (error) {
      setMessage(error.message || "Could not export evidence packet.");
    }
  }

  if (!signedInLike || !isAdmin) {
    return (
      <div className="v2-workspace-page">
        <PageHeader
          compact
          eyebrow="Moderation"
          title="Moderator access only."
          description="Reports, enforcement actions, and diagnostics stay outside the normal student workspace."
        />
      </div>
    );
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Moderation"
        title="Run reports, enforcement, analytics, and AI diagnostics from one operator surface."
        description="Review reports and take action on platform health."
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-metric-grid v2-metric-grid-wide">
        <MetricTile label="Open reports" value={analytics?.openReports ?? 0} detail="awaiting review" tone="admin" />
        <MetricTile label="High severity" value={analytics?.highSeverityReports ?? 0} detail="needs fast response" tone="safety" />
        <MetricTile label="Actions" value={analytics?.moderationActions ?? 0} detail="enforcement applied" tone="neutral" />
        <MetricTile label="Hidden or suspended" value={analytics?.hiddenOrSuspendedListings ?? 0} detail="visibility enforcement" tone="selling" />
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Action desk" description="Apply moderation to a specific report with a clear note and action history.">
          <form className="v2-field-stack" onSubmit={applyAction}>
            <label className="v2-field">
              <span>Report ID</span>
              <input value={reportId} onChange={(event) => setReportId(event.target.value)} placeholder="Paste report ID" />
            </label>
            <label className="v2-field">
              <span>Action</span>
              <SelectField
                value={action}
                onChange={setAction}
                options={[
                  { value: "warn_user", label: "Warn user" },
                  { value: "hide_listing", label: "Hide listing" },
                  { value: "suspend_listing", label: "Suspend listing" },
                  { value: "suspend_account", label: "Suspend account" },
                  { value: "ban_account", label: "Ban account" },
                ]}
              />
            </label>
            <label className="v2-field">
              <span>Operator note</span>
              <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reasoning, evidence summary, or escalation note." />
            </label>
            <Button type="submit" disabled={busy === "action"}>{busy === "action" ? "Applying..." : "Apply action"}</Button>
          </form>
        </Surface>

        <Surface title="AI visibility" description="Fallback rate and recent provider behavior should stay visible to moderators.">
          {diagnostics ? (
            <div className="v2-inline-list">
              <div className="v2-inline-row">
                <div>
                  <strong>Total AI events</strong>
                  <span>{diagnostics.totalEvents || 0} provider events recorded by the backend.</span>
                </div>
                <small>{diagnostics.avgLatencyMs ? `${diagnostics.avgLatencyMs} ms` : "latency n/a"}</small>
              </div>
              <div className="v2-inline-row">
                <div>
                  <strong>Fallbacks</strong>
                  <span>{diagnostics.fallbackCount || 0} calls needed fallback logic.</span>
                </div>
                <small>{diagnostics.timeoutCount || 0} timeouts</small>
              </div>
            </div>
          ) : (
            <EmptyBlock title="No AI diagnostics available" description="Diagnostics will show here once the backend records provider activity." />
          )}
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Open reports" description="Review the active queue and export evidence packets when needed.">
          {reports.length ? (
            <div className="v2-inline-list">
              {reports.map((report) => (
                <div key={report.id} className="v2-inline-row">
                  <div>
                    <strong>{report.reason.replaceAll("_", " ")}</strong>
                    <span>{report.targetType} / {report.severity} / {report.status}</span>
                  </div>
                  <div className="v2-inline-actions">
                    {report.targetType === "listing" ? (
                      <Button href={`/listings/${report.targetId}`} variant="secondary">Open listing</Button>
                    ) : null}
                    <button type="button" className="v2-card-icon-button" onClick={() => setReportId(report.id)}>
                      Use ID
                    </button>
                    <button type="button" className="v2-card-icon-button" onClick={() => exportReportPdf(report.id)}>
                      Export PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No reports loaded" description="Reports will populate here when users file them from listing or chat surfaces." />
          )}
        </Surface>

        <Surface title="Platform context" description="Moderation should see the broader marketplace state before deciding on enforcement pressure.">
          {platformAnalytics ? (
            <div className="v2-inline-list">
              <div className="v2-inline-row"><div><strong>Profiles</strong><span>{platformAnalytics.totalProfiles || 0} total profiles on platform.</span></div></div>
              <div className="v2-inline-row"><div><strong>Live listings</strong><span>{platformAnalytics.activeListings || 0} active public listings.</span></div></div>
              <div className="v2-inline-row"><div><strong>Favorites</strong><span>{platformAnalytics.totalFavorites || 0} saved interactions.</span></div></div>
              <div className="v2-inline-row"><div><strong>Chats</strong><span>{platformAnalytics.totalConversations || 0} listing-linked threads in motion.</span></div></div>
            </div>
          ) : (
            <EmptyBlock title="No platform analytics loaded" description="Platform metrics will appear here once the backend responds." />
          )}
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Moderation history" description="Applied actions should stay visible enough for auditability and operator confidence.">
          {actions.length ? (
            <div className="v2-inline-list">
              {actions.map((item) => (
                <div key={item.id} className="v2-inline-row">
                  <div>
                    <strong>{item.action.replaceAll("_", " ")}</strong>
                    <span>{item.admin?.fullName || "Admin"} / report {item.reportId}</span>
                  </div>
                  <small>{new Date(item.createdAt).toLocaleDateString("en-IN")}</small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No moderation history yet" description="Applied actions will appear here after the first operator decision is recorded." />
          )}
        </Surface>

        <Surface title="Recent provider events" description="A compact feed of backend provider behavior for operator visibility.">
          {providerEvents.length ? (
            <div className="v2-inline-list">
              {providerEvents.map((item) => (
                <div key={item.id} className="v2-inline-row">
                  <div>
                    <strong>{item.operation || item.eventType || "AI event"}</strong>
                    <span>{item.provider || "provider"} / {item.status || "unknown"} / {item.usedFallback ? "fallback" : "live provider"}</span>
                  </div>
                  <div className="v2-stack-inline">
                    {item.httpStatus ? <StatusPill tone="neutral">{item.httpStatus}</StatusPill> : null}
                    {item.usedFallback ? <StatusPill tone="safety">fallback</StatusPill> : <StatusPill tone="buying">live</StatusPill>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No provider events yet" description="Provider diagnostics will show here once the AI layer records activity." />
          )}
        </Surface>
      </div>
    </div>
  );
}
