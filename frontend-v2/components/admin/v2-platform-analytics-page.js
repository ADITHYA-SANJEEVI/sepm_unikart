"use client";

import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, PageHeader, Surface } from "@/components/system/primitives";
import { apiFetch, formatCurrency } from "@/lib/api";

export function V2PlatformAnalyticsPage() {
  const { auth, signedInLike } = useV2AppState();
  const [platformAnalytics, setPlatformAnalytics] = useState(null);
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [listings, setListings] = useState([]);

  const isAdmin = !!(auth.overrideSecret || auth.profile?.role === "admin" || auth.devRole === "admin");

  useEffect(() => {
    if (!signedInLike || !isAdmin) return;
    Promise.all([
      apiFetch("/admin/platform-analytics", auth).catch(() => ({ data: null })),
      apiFetch("/admin/analytics", auth).catch(() => ({ data: null })),
      apiFetch("/listings?sort=trust_desc&limit=18", auth, { cacheMs: 45000 }).catch(() => ({ data: [] })),
    ]).then(([platformResponse, adminResponse, listingResponse]) => {
      setPlatformAnalytics(platformResponse.data || null);
      setAdminAnalytics(adminResponse.data || null);
      setListings(listingResponse.data || []);
    });
  }, [signedInLike, isAdmin, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  const mostSaved = useMemo(
    () => [...listings].sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0)).slice(0, 5),
    [listings],
  );
  const strongestTrust = useMemo(
    () => [...listings].sort((a, b) => (b.trustScore || 0) - (a.trustScore || 0)).slice(0, 5),
    [listings],
  );

  if (!signedInLike || !isAdmin) {
    return (
      <div className="v2-workspace-page">
        <PageHeader compact eyebrow="Platform" title="Admin access only." description="Platform analytics stays visible only to operator sessions." />
      </div>
    );
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Platform"
        title="Track marketplace health, traction, and what users are actually responding to."
        description="See demand, trust, and attention patterns across the marketplace."
        actions={<Button href="/moderation" variant="secondary">Open moderation</Button>}
      />

      <div className="v2-metric-grid v2-metric-grid-wide">
        <MetricTile label="Profiles" value={platformAnalytics?.totalProfiles ?? 0} detail="total campus accounts" tone="neutral" />
        <MetricTile label="Active listings" value={platformAnalytics?.activeListings ?? 0} detail="currently public" tone="selling" />
        <MetricTile label="Favorites" value={platformAnalytics?.totalFavorites ?? 0} detail="saved interactions" tone="buying" />
        <MetricTile label="Open reports" value={adminAnalytics?.openReports ?? 0} detail="needs review" tone="admin" />
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Most saved listings" description="The listings drawing the strongest repeat attention right now.">
          {mostSaved.length ? (
            <div className="v2-inline-list">
              {mostSaved.map((item) => (
                <a key={item.id} href={`/listings/${item.id}`} className="v2-link-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.favoriteCount || 0} saves / {formatCurrency(item.price)} / {item.area || "Campus"}</span>
                  </div>
                  <small>{item.category || "listing"}</small>
                </a>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No saved-listing data yet" description="Once students start saving listings, the top set will surface here." />
          )}
        </Surface>

        <Surface title="Highest trust listings" description="Listings with the strongest trust score and completion signals.">
          {strongestTrust.length ? (
            <div className="v2-inline-list">
              {strongestTrust.map((item) => (
                <a key={item.id} href={`/listings/${item.id}`} className="v2-link-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.trustScore ?? 0}/100 trust / {item.favoriteCount || 0} saves</span>
                  </div>
                  <small>{item.seller?.fullName || "Campus seller"}</small>
                </a>
              ))}
            </div>
          ) : (
            <EmptyBlock title="No trust-ranked listings yet" description="Trust-ranked marketplace highlights will appear here when listing data is available." />
          )}
        </Surface>

        <Surface title="Fast movers" description="Recently active listings with strong saves, trust, or recent attention.">
          {listings.length ? (
            <div className="v2-inline-list">
              {[...listings]
                .sort((a, b) => ((b.favoriteCount || 0) + (b.trustScore || 0)) - ((a.favoriteCount || 0) + (a.trustScore || 0)))
                .slice(0, 5)
                .map((item) => (
                  <a key={item.id} href={`/listings/${item.id}`} className="v2-link-row">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{formatCurrency(item.price)} / {item.area || "Campus"} / trust {item.trustScore ?? 40}</span>
                    </div>
                    <small>{item.favoriteCount || 0} saves</small>
                  </a>
                ))}
            </div>
          ) : (
            <EmptyBlock title="No active highlights yet" description="Popular and trusted listings will appear here when browse activity builds up." />
          )}
        </Surface>
      </div>
    </div>
  );
}
