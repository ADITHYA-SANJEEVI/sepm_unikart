"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch } from "@/lib/api";

function formatDate(value) {
  if (!value) return "Recently";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "Recently";
  }
}

function getNotificationHref(item) {
  if (item?.actionHref) return item.actionHref;
  if (item?.entityType === "listing" && item?.entityId) return `/listings/${item.entityId}`;
  if (item?.entityType === "profile" && item?.entityId) return `/profiles/${item.entityId}`;
  if (item?.entityType === "conversation") return "/messages";
  if (item?.entityType === "schedule") return "/schedules";
  return "/notifications";
}

function summarizeFilter(filterPayload = {}) {
  const parts = [];
  if (filterPayload.search) parts.push(`"${filterPayload.search}"`);
  if (filterPayload.category) parts.push(String(filterPayload.category));
  if (filterPayload.condition) parts.push(String(filterPayload.condition).replaceAll("_", " "));
  if (filterPayload.mode) parts.push(String(filterPayload.mode));
  if (filterPayload.maxPrice) parts.push(`under INR ${filterPayload.maxPrice}`);
  if (filterPayload.negotiableOnly) parts.push("negotiable");
  if (filterPayload.deliveryOnly) parts.push("campus drop");
  return parts.length ? parts.join(" • ") : "All campus listings";
}

const laneTone = {
  buying: "buying",
  selling: "selling",
  safety: "safety",
  system: "neutral",
  admin: "admin",
};

export function DashboardPage() {
  const { auth, signedInLike, compareIds } = useV2AppState();
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [platformAnalytics, setPlatformAnalytics] = useState(null);
  const [notificationInbox, setNotificationInbox] = useState(null);
  const [loading, setLoading] = useState(true);

  const workspaceRole = auth.profile?.role || auth.devRole || "buyer";
  const isAdmin = workspaceRole === "admin";
  useEffect(() => {
    if (!signedInLike) {
      setSummary(null);
      setAnalytics(null);
      setAdminAnalytics(null);
      setPlatformAnalytics(null);
      setNotificationInbox(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const requests = [
      apiFetch("/dashboard/summary", auth).catch(() => ({ data: null })),
      apiFetch("/dashboard/analytics", auth).catch(() => ({ data: null })),
      apiFetch("/users/notification-inbox", auth).catch(() => ({ data: null })),
    ];

    if (isAdmin) {
      requests.push(
        apiFetch("/admin/analytics", auth).catch(() => ({ data: null })),
        apiFetch("/admin/platform-analytics", auth).catch(() => ({ data: null })),
      );
    }

    Promise.all(requests).then((responses) => {
      if (cancelled) return;
      setSummary(responses[0]?.data || null);
      setAnalytics(responses[1]?.data || null);
      setNotificationInbox(responses[2]?.data || null);
      setAdminAnalytics(isAdmin ? responses[3]?.data || null : null);
      setPlatformAnalytics(isAdmin ? responses[4]?.data || null : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [signedInLike, isAdmin, auth.accessToken, auth.overrideSecret, auth.devEmail, auth.devRole, auth.devFullName, auth.profile?.id]);

  const heroMetrics = useMemo(() => {
    if (!signedInLike) {
      return [
        { label: "Saved alerts", value: "Live", detail: "matches and shortlist changes", tone: "buying" },
        { label: "Selling tools", value: "Ready", detail: "listings, pricing, and meetups", tone: "selling" },
        { label: "Safety layer", value: "Built-in", detail: "guidance, reports, and trust context", tone: "safety" },
      ];
    }

    return [
      {
        label: "Unread updates",
        value: String(summary?.unreadNotificationCount ?? 0),
        detail: "messages, matches, and state changes",
        tone: "buying",
      },
      {
        label: workspaceRole === "seller" ? "Active listings" : workspaceRole === "admin" ? "Open reports" : "Saved listings",
        value: String(
          workspaceRole === "seller"
            ? summary?.activeListings ?? 0
            : workspaceRole === "admin"
              ? adminAnalytics?.openReports ?? 0
              : summary?.favoriteCount ?? 0,
        ),
        detail: workspaceRole === "seller" ? "live and buyer-facing" : workspaceRole === "admin" ? "moderation pressure" : "decision-ready shortlist",
        tone: workspaceRole === "admin" ? "admin" : workspaceRole === "seller" ? "selling" : "buying",
      },
      {
        label: "Meetups",
        value: String(summary?.scheduleCount ?? 0),
        detail: "handoffs to coordinate",
        tone: "neutral",
      },
    ];
  }, [signedInLike, summary, workspaceRole, adminAnalytics]);

  const priorityItems = useMemo(() => {
    const direct = notificationInbox?.all?.needsAction || [];
    if (direct.length) return direct.slice(0, 4);
    return (summary?.notifications || []).slice(0, 4);
  }, [notificationInbox, summary]);

  const workspaceItems = useMemo(() => {
    if (!signedInLike) {
      return [
        {
          title: "Buyer dashboard",
          description: "Track saved listings, compare decisions, price changes, and search alerts in one place.",
          href: "/marketplace",
          action: "Browse listings",
        },
        {
          title: "Seller dashboard",
          description: "Manage active inventory, watch buyer traction, and stay ahead of meetup requests.",
          href: "/sell",
          action: "Open sell studio",
        },
        {
          title: "Safe transactions",
          description: "Messages, holds, meetups, and support stay tied to the exact listing context.",
          href: "/support",
          action: "Read support",
        },
      ];
    }

    if (workspaceRole === "seller") {
      return [
        {
          title: "Manage listings",
          description: `${summary?.activeListings ?? 0} active, ${summary?.reservedListings ?? 0} reserved, ${summary?.soldListings ?? 0} sold`,
          href: auth.profile ? `/profiles/${auth.profile.id}` : "/sell",
          action: "Open workspace",
        },
        {
          title: "Buyer traction",
          description: `${analytics?.seller?.totalFavorites ?? 0} saves and ${analytics?.seller?.totalConversations ?? 0} active conversations`,
          href: "/messages",
          action: "Reply to buyers",
        },
        {
          title: "Meetups and holds",
          description: `${analytics?.seller?.totalHolds ?? 0} holds and ${analytics?.seller?.totalSchedules ?? 0} meetup plans`,
          href: "/schedules",
          action: "Review handoffs",
        },
      ];
    }

    if (workspaceRole === "admin") {
      return [
        {
          title: "Moderation queue",
          description: `${adminAnalytics?.openReports ?? 0} open reports, ${adminAnalytics?.highSeverityReports ?? 0} high severity`,
          href: "/moderation",
          action: "Review reports",
        },
        {
          title: "Visibility enforcement",
          description: `${adminAnalytics?.hiddenOrSuspendedListings ?? 0} hidden or suspended listings`,
          href: "/moderation",
          action: "Inspect actions",
        },
        {
          title: "Platform snapshot",
          description: `${platformAnalytics?.totalProfiles ?? 0} profiles, ${platformAnalytics?.activeListings ?? 0} live listings`,
          href: "/moderation",
          action: "Open analytics",
        },
      ];
    }

    return [
      {
        title: "Saved shortlist",
        description: `${summary?.favoriteCount ?? 0} saved listings and ${compareIds.length} in compare`,
        href: "/favorites",
        action: "Open saved items",
      },
      {
        title: "Matches and alerts",
        description: `${summary?.savedFilters?.length ?? 0} saved searches with ${summary?.unreadNotificationCount ?? 0} unread updates`,
        href: "/notifications",
        action: "Review alerts",
      },
      {
        title: "Messages and meetups",
        description: `${summary?.conversationCount ?? 0} conversations and ${summary?.scheduleCount ?? 0} handoffs`,
        href: "/messages",
        action: "Continue conversations",
      },
    ];
  }, [signedInLike, workspaceRole, summary, analytics, auth.profile, compareIds.length, adminAnalytics, platformAnalytics]);

  const savedFilters = summary?.savedFilters?.slice(0, 3) || [];
  const recentViews = summary?.recentlyViewed?.slice(0, 4) || [];
  const laneHighlights = notificationInbox?.highlights || [];

  if (!signedInLike) {
    return (
      <div className="v2-dashboard-page">
        <PageHeader
          eyebrow="Dashboard"
          title="Your marketplace workspace, once you sign in."
          description="See urgent activity first and manage buying and selling in one place."
          actions={
            <>
              <Button href="/marketplace">Browse Listings</Button>
              <Button href="/auth" variant="secondary">Sign In</Button>
            </>
          }
        />

        <section className="v2-dashboard-hero">
          <div className="v2-dashboard-hero-copy">
            <StatusPill tone="buying">Buyer and seller ready</StatusPill>
            <h2>Start from what matters now, not from a cluttered card wall.</h2>
            <p>
              Open the dashboard to see activity first, then the main tools you need for buying, selling, and follow-through.
            </p>
            <div className="v2-page-header-actions">
              <Button href="/marketplace">Explore Campus Listings</Button>
              <Button href="/sell" variant="secondary">Open Sell Studio</Button>
            </div>
          </div>
          <div className="v2-dashboard-hero-metrics">
            {heroMetrics.map((metric) => (
              <MetricTile key={metric.label} {...metric} />
            ))}
          </div>
        </section>

        <div className="v2-dashboard-grid">
          <Surface title="What you can do here" description="Quick access to the most important routes and tasks.">
            <div className="v2-inline-list">
              {workspaceItems.map((item) => (
                <Link key={item.title} href={item.href} className="v2-link-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <small>{item.action}</small>
                </Link>
              ))}
            </div>
          </Surface>

          <Surface title="What to expect" description="Every page follows the same interaction and trust rules.">
            <div className="v2-checklist">
              <span>Clear loading, empty, and error states</span>
              <span>Mobile-safe actions and spacing</span>
              <span>Direct paths between listing, chat, compare, and meetups</span>
              <span>No dead controls and no filler copy</span>
            </div>
          </Surface>
        </div>
      </div>
    );
  }

  return (
    <div className="v2-dashboard-page">
      <PageHeader
        eyebrow="Dashboard"
        title={
          workspaceRole === "seller"
            ? "Run your campus storefront with fewer blind spots."
            : workspaceRole === "admin"
              ? "Manage your active listings, profile settings, and seller activity."
              : "Manage your shortlist, alerts, and conversations."
        }
        description={
          loading
            ? "Loading your latest listings, alerts, and workspace activity."
            : "Urgent activity comes first, followed by your active workspace and tools."
        }
        actions={
          <>
            <Button href={workspaceRole === "admin" ? "/moderation" : workspaceRole === "seller" ? "/sell" : "/marketplace"}>
              {workspaceRole === "admin" ? "Open Moderation" : workspaceRole === "seller" ? "Create Listing" : "Browse Listings"}
            </Button>
            <Button href={auth.profile ? `/profiles/${auth.profile.id}` : "/auth"} variant="secondary">
              Open Profile
            </Button>
          </>
        }
      />

      <section className="v2-dashboard-hero">
        <div className="v2-dashboard-hero-copy">
          <div className="v2-stack">
            <StatusPill tone={workspaceRole === "admin" ? "admin" : workspaceRole === "seller" ? "selling" : "buying"}>
              {workspaceRole}
            </StatusPill>
            <StatusPill tone="neutral">
              {auth.profile?.isVerified ? "Verified campus profile" : "Complete trust details"}
            </StatusPill>
          </div>
          <h2>
            {loading
              ? "Pulling together your current marketplace state."
              : `${summary?.unreadNotificationCount ?? 0} updates and ${priorityItems.length} items worth checking now.`}
          </h2>
          <p>
            Your listings, alerts, compare queue, chats, and meetup plans stay visible in one place.
          </p>
          <div className="v2-page-header-actions">
            <Button href="/notifications" variant="secondary">Notifications</Button>
            <Button href="/messages" variant="secondary">Messages</Button>
            <Button href="/compare" variant="ghost">Compare</Button>
          </div>
        </div>
        <div className="v2-dashboard-hero-metrics">
          {heroMetrics.map((metric) => (
            <MetricTile key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <div className="v2-dashboard-grid">
        <Surface title="Needs attention" description="The smallest set of items that should shape your next move.">
          {loading ? (
            <EmptyBlock title="Loading activity" description="Pulling messages, alerts, and listing state from the backend." />
          ) : priorityItems.length ? (
            <div className="v2-inline-list">
              {priorityItems.map((item) => (
                <Link key={item.id} href={getNotificationHref(item)} className="v2-link-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                  <small>{item.actionLabel || "Open"}</small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock
              title="No urgent items right now"
              description="That is the healthy state. Use the rest of the dashboard for browse, listing quality work, or profile cleanup."
            />
          )}
        </Surface>

        <Surface title="Activity lanes" description="Notifications work best when buying, selling, safety, and system context stay distinct.">
          {laneHighlights.length ? (
            <div className="v2-lane-grid">
              {laneHighlights.map((lane) => (
                <div key={lane.lane} className="v2-lane-card">
                  <StatusPill tone={laneTone[lane.lane] || "neutral"}>{lane.lane}</StatusPill>
                  <strong>{lane.count} updates</strong>
                  <span>{lane.unreadCount} unread</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No live lanes yet" description="Once alerts, chat, and state changes start moving, each lane will show its own pressure." />
          )}
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title={workspaceRole === "seller" ? "Seller workspace" : workspaceRole === "admin" ? "Admin workspace" : "Buyer workspace"} description="The main workspace adapts to what you are here to do.">
          <div className="v2-inline-list">
            {workspaceItems.map((item) => (
              <Link key={item.title} href={item.href} className="v2-link-row">
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </div>
                <small>{item.action}</small>
              </Link>
            ))}
          </div>
        </Surface>

        <Surface title="Personal tools" description="Shortcuts stay close without turning the dashboard into another navigation wall.">
          <div className="v2-utility-grid">
            <Link href="/favorites" className="v2-tool-link">
              <strong>Saved listings</strong>
              <span>Track shortlist changes and return quickly.</span>
            </Link>
            <Link href="/compare" className="v2-tool-link">
              <strong>Compare queue</strong>
              <span>{compareIds.length ? `${compareIds.length} items ready to compare.` : "Keep up to three listings in view."}</span>
            </Link>
            <Link href="/messages" className="v2-tool-link">
              <strong>Messages</strong>
              <span>Conversations, offers, and transaction follow-through.</span>
            </Link>
            <Link href="/schedules" className="v2-tool-link">
              <strong>Meetups</strong>
              <span>Track proposals, confirmations, and route changes.</span>
            </Link>
          </div>
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Analytics snapshot" description="Useful numbers, kept compact enough to stay actionable.">
          <div className="v2-metric-grid">
            <MetricTile
              label="Favorites"
              value={String(analytics?.seller?.totalFavorites ?? summary?.favoriteCount ?? 0)}
              detail="current buyer interest"
              tone="buying"
            />
            <MetricTile
              label="Conversations"
              value={String(analytics?.seller?.totalConversations ?? summary?.conversationCount ?? 0)}
              detail="active negotiation paths"
              tone="neutral"
            />
            <MetricTile
              label="Alert filters"
              value={String(analytics?.buyer?.alertEnabledFilters ?? summary?.savedFilters?.length ?? 0)}
              detail="saved discovery objects"
              tone="selling"
            />
          </div>
          {workspaceRole === "admin" && adminAnalytics ? (
            <p className="v2-summary-note">
              {adminAnalytics.openReports} open reports, {adminAnalytics.highSeverityReports} high-severity items, and {adminAnalytics.moderationActions} recorded moderation actions.
            </p>
          ) : null}
        </Surface>

        <Surface title="Profile and trust" description="Account quality stays visible without burying settings deep in the UI.">
          <div className="v2-profile-card">
            <div>
              <strong>{auth.profile?.fullName || auth.devFullName || "Campus account"}</strong>
              <span>{auth.profile?.sellerHeadline || auth.profile?.bio || "Add a short headline, bio, and meetup defaults to make your account more credible."}</span>
            </div>
            <div className="v2-stack">
              <StatusPill tone={auth.profile?.isVerified ? "selling" : "neutral"}>
                {auth.profile?.isVerified ? "verified" : "complete profile"}
              </StatusPill>
              <StatusPill tone="neutral">
                {typeof auth.profile?.profileCompleteness === "number"
                  ? `${auth.profile.profileCompleteness}% complete`
                  : "profile setup in progress"}
              </StatusPill>
            </div>
          </div>
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Saved searches" description="Named searches stay visible and easy to reopen.">
          {savedFilters.length ? (
            <div className="v2-inline-list">
              {savedFilters.map((filter) => (
                <Link key={filter.id} href="/marketplace" className="v2-link-row">
                  <div>
                    <strong>{filter.label}</strong>
                    <span>{summarizeFilter(filter.filterPayload)}</span>
                  </div>
                  <small>
                    {filter.alertEnabled ? "alerts on" : "alerts off"}
                    {filter.lastTriggeredAt ? ` • ${formatDate(filter.lastTriggeredAt)}` : ""}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No saved searches yet" description="Save a filter from browse and it will appear here with alert status and recent match history." />
          )}
        </Surface>

        <Surface title="Recently viewed" description="Quick return points stay visible without feeling like browser history.">
          {recentViews.length ? (
            <div className="v2-inline-list">
              {recentViews.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="v2-link-row">
                  <div>
                    <strong>{listing.title}</strong>
                    <span>{listing.area || "Campus"} • {listing.mode || "sale"}</span>
                  </div>
                  <small>{formatDate(listing.updatedAt)}</small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No recent detail views yet" description="As you inspect listings in detail, they will show up here for quick return." />
          )}
        </Surface>
      </div>
    </div>
  );
}
