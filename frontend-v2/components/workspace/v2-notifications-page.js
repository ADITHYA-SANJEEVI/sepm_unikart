"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch } from "@/lib/api";

function getNotificationHref(item) {
  if (item.actionHref) return item.actionHref;
  if (item.entityType === "conversation") {
    const listingId = item.metadata?.listingId || item.listingId;
    return listingId ? `/messages?listingId=${listingId}` : "/messages";
  }
  if (item.entityType === "listing" && item.entityId) return `/listings/${item.entityId}`;
  if (item.entityType === "schedule") return "/schedules";
  return "/dashboard";
}

const lanes = ["all", "buying", "selling", "safety", "system", "admin"];

function getLaneTone(lane) {
  if (lane === "buying") return "buying";
  if (lane === "selling") return "selling";
  if (lane === "safety") return "safety";
  if (lane === "admin") return "admin";
  return "neutral";
}

export function V2NotificationsPage() {
  const { auth, signedInLike, refreshNotifications } = useV2AppState();
  const [inbox, setInbox] = useState(null);
  const [activeLane, setActiveLane] = useState("all");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState(null);
  const [prefsBusy, setPrefsBusy] = useState(false);

  function loadInbox() {
    if (!signedInLike) {
      setInbox(null);
      return Promise.resolve();
    }
    return Promise.all([
      apiFetch("/users/notifications/inbox", auth).catch(() => ({ data: null })),
      apiFetch("/users/notification-preferences", auth).catch(() => ({ data: null })),
    ]).then(([inboxResponse, prefResponse]) => {
      setInbox(inboxResponse.data || null);
      setPreferences(prefResponse.data || null);
    });
  }

  useEffect(() => {
    loadInbox().catch(() => {
      setInbox(null);
      setMessage("Could not load notifications.");
    });
  }, [signedInLike, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const laneData = inbox?.[activeLane] || inbox?.all || { needsAction: [], recent: [], earlier: [] };
  const visibleLanes = lanes.filter((lane) => lane === "all" || (inbox?.counts?.[lane] ?? 0) > 0);
  const sections = useMemo(
    () => [
      { key: "needsAction", title: "Needs action", items: laneData.needsAction || [] },
      { key: "recent", title: "Recent", items: laneData.recent || [] },
      { key: "earlier", title: "Earlier", items: laneData.earlier || [] },
    ],
    [laneData],
  );

  async function markAllRead() {
    setBusy("all");
    try {
      await apiFetch("/users/notifications/read-all", auth, { method: "PATCH" });
      await Promise.all([loadInbox(), refreshNotifications({ bypassCache: true })]);
    } catch {
      setMessage("Could not mark all notifications as read.");
    } finally {
      setBusy("");
    }
  }

  async function markRead(id) {
    setBusy(id);
    try {
      await apiFetch(`/users/notifications/${id}/read`, auth, { method: "PATCH" });
      await Promise.all([loadInbox(), refreshNotifications({ bypassCache: true })]);
    } catch {
      setMessage("Could not update notification state.");
    } finally {
      setBusy("");
    }
  }

  async function dismiss(id) {
    setBusy(id);
    try {
      await apiFetch(`/users/notifications/${id}`, auth, { method: "DELETE" });
      await Promise.all([loadInbox(), refreshNotifications({ bypassCache: true })]);
    } catch {
      setMessage("Could not dismiss notification.");
    } finally {
      setBusy("");
    }
  }

  async function updatePreference(key, value) {
    setPrefsBusy(true);
    const next = { ...(preferences || {}), [key]: value };
    setPreferences(next);
    try {
      const response = await apiFetch("/users/notification-preferences", auth, {
        method: "PATCH",
        body: { [key]: value },
      });
      setPreferences(response.data || next);
    } catch {
      setPreferences((current) => ({ ...(current || {}), [key]: !value }));
      setMessage("Could not update preferences.");
    } finally {
      setPrefsBusy(false);
    }
  }

  if (!signedInLike) {
    return (
      <div className="v2-notifications-page">
        <PageHeader
          compact
          eyebrow="Notifications"
          title="Sign in to view your notifications."
          description="Buying, selling, safety, and system updates only become useful once they are tied to your real account state."
        />
      </div>
    );
  }

  return (
    <div className="v2-notifications-page">
      <PageHeader
        compact
        eyebrow="Notifications"
        title="Your Notifications"
        description="See what changed, what needs attention, and where to go next without one cluttered feed."
        actions={<Button variant="secondary" onClick={markAllRead} disabled={busy === "all"}>Mark all read</Button>}
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-dashboard-grid">
        <Surface title="Notification lanes" description="Switch between buying, selling, safety, and system updates.">
          <div className="v2-lane-grid">
            {visibleLanes.map((lane) => (
              <button
                key={lane}
                type="button"
                className={`v2-lane-card ${activeLane === lane ? "v2-lane-card-active" : ""}`}
                onClick={() => setActiveLane(lane)}
              >
                <StatusPill tone={getLaneTone(lane)}>{lane}</StatusPill>
                <strong>{inbox?.counts?.[lane] ?? 0}</strong>
                <span>{lane === "all" ? `${inbox?.counts?.unread ?? 0} unread` : `${(inbox?.[lane]?.needsAction || []).length} urgent`}</span>
              </button>
            ))}
          </div>
        </Surface>

        <Surface title="Preferences" description="Manage alert categories without leaving the inbox.">
          {preferences ? (
            <div className="v2-inline-list">
              {[
                { key: "buying", label: "Buying updates" },
                { key: "selling", label: "Selling updates" },
                { key: "safety", label: "Safety alerts" },
                { key: "system", label: "System notices" },
                { key: "savedSearchAlerts", label: "Saved search alerts" },
              ].map((item) => (
                <label key={item.key} className="v2-inline-row v2-inline-row-static">
                  <div>
                    <strong>{item.label}</strong>
                    <span>Turn this category on or off without leaving the inbox.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences[item.key])}
                    disabled={prefsBusy}
                    onChange={(event) => updatePreference(item.key, event.target.checked)}
                    className="v2-toggle"
                  />
                </label>
              ))}
            </div>
          ) : (
            <EmptyBlock title="Preferences unavailable" description="Notification preferences will appear here when the backend responds." />
          )}
        </Surface>
      </div>

      {sections.map((section) => (
        <Surface key={section.key} title={section.title} description="">
          {section.items.length ? (
            <div className="v2-inline-list">
              {section.items.map((item) => (
                <div key={item.id} className="v2-link-row v2-link-row-static">
                  <div>
                    <div className="v2-stack-inline">
                      <strong>{item.title}</strong>
                      <StatusPill tone={getLaneTone(item.lane)}>{item.lane}</StatusPill>
                    </div>
                    <span>{item.body}</span>
                  </div>
                  <div className="v2-inline-actions">
                    <Link href={getNotificationHref(item)} className="v2-card-icon-button">{item.actionLabel || "Open"}</Link>
                    {!item.readAt ? (
                      <button type="button" className="v2-card-icon-button" onClick={() => markRead(item.id)} disabled={busy === item.id}>Read</button>
                    ) : null}
                    <button type="button" className="v2-card-icon-button" onClick={() => dismiss(item.id)} disabled={busy === item.id}>Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title={`No ${section.title.toLowerCase()} items`} description="This lane is clear right now." />
          )}
        </Surface>
      ))}
    </div>
  );
}
