"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, NoticeBanner, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch, downloadApiFile, formatCurrency } from "@/lib/api";
import { getNextCompareQueue } from "@/lib/compare";
import { downloadProfilePdfFallback } from "@/lib/profile-pdf";

const listingTabs = ["all", "active", "reserved", "sold", "draft", "hidden", "suspended"];

function sanitizeContactNote(value = "") {
  return String(value)
    .replace(/\b\d{10,13}\b/g, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/(?:whatsapp|telegram|instagram|snapchat)/gi, "")
    .trim();
}

function formatLabel(value, fallback = "Not set") {
  const text = String(value || "").replaceAll("_", " ").trim();
  return text || fallback;
}

function buildDuplicatePayload(listing) {
  return {
    title: `${listing.title} copy`,
    description: listing.description || "Campus listing copy",
    price: Number(listing.price || 0),
    inventoryCount: Math.max(1, Number(listing.inventoryCount || 1)),
    category: listing.category || "electronics",
    condition: listing.condition || "good",
    negotiable: Boolean(listing.negotiable),
    fulfillmentModes: (listing.fulfillmentModes || []).length ? listing.fulfillmentModes : ["meetup"],
    area: listing.area || "Campus",
    imageUrls: (listing.imageUrls || []).filter(Boolean).slice(0, 7),
    mediaAssetIds: (listing.mediaAssets || []).map((item) => item.id).filter(Boolean).slice(0, 7),
    tags: (listing.tags || []).filter(Boolean).slice(0, 10),
    status: "draft",
    mode: listing.mode || "sale",
    rentDetails: listing.rentDetails || undefined,
    bundleDetails: listing.bundleDetails || undefined,
    listingMetadata: listing.listingMetadata || undefined,
  };
}

function tabCount(listings, tab) {
  if (tab === "all") return listings.length;
  return listings.filter((item) => item.status === tab).length;
}

function actionCopy(action) {
  return {
    "mark-sold": { pending: "Marking sold...", success: "Listing marked sold." },
    relist: { pending: "Relisting...", success: "Listing relisted." },
    duplicate: { pending: "Duplicating draft...", success: "Draft copy created." },
    archive: { pending: "Archiving...", success: "Listing archived." },
    delete: { pending: "Deleting listing...", success: "Listing deleted." },
  }[action] || { pending: "Updating listing...", success: "Listing updated." };
}

function pendingActionForListing(busyId, listingId) {
  const actions = ["mark-sold", "relist", "duplicate", "archive", "delete"];
  return actions.find((action) => busyId === `${action}-${listingId}`) || "";
}

export function V2ProfilePage({ profileId }) {
  const searchParams = useSearchParams();
  const {
    auth,
    setAuth,
    compareIds,
    toggleCompareListing,
    clearCompareQueue,
    openCompareOverlay,
    notifications,
    refreshNotifications,
  } = useV2AppState();
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [draft, setDraft] = useState({
    fullName: "",
    bio: "",
    contactNumber: "",
    hostel: "",
    department: "",
    sellerHeadline: "",
    preferredMeetupSpot: "",
    favoriteCategories: "",
  });

  const isOwnProfile = auth.profile?.id === profileId;
  const isPublicPreview = isOwnProfile && searchParams.get("view") === "public";
  const showOwnTools = isOwnProfile && !isPublicPreview;

  async function loadProfile() {
    const [profileResponse, listingsResponse, analyticsResponse, blockedResponse, recentResponse, preferenceResponse] = await Promise.all([
      apiFetch(`/profiles/${profileId}`, auth).catch(() => ({ data: null })),
      apiFetch(`/profiles/${profileId}/listings`, auth).catch(() => ({ data: [] })),
      isOwnProfile ? apiFetch("/dashboard/analytics", auth).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      isOwnProfile ? apiFetch("/users/blocked", auth).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      isOwnProfile ? apiFetch("/users/recently-viewed", auth).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      isOwnProfile ? apiFetch("/users/notification-preferences", auth).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
    ]);

    setProfile(profileResponse.data || null);
    setListings(listingsResponse.data || []);
    setAnalytics(analyticsResponse.data || null);
    setBlockedUsers(blockedResponse.data || []);
    setRecentlyViewed(recentResponse.data || []);
    setNotificationPreferences(preferenceResponse.data || null);

    if (profileResponse.data) {
      setDraft({
        fullName: profileResponse.data.fullName || "",
        bio: profileResponse.data.bio || "",
        contactNumber: profileResponse.data.contactNumber || "",
        hostel: profileResponse.data.hostel || "",
        department: profileResponse.data.department || "",
        sellerHeadline: profileResponse.data.sellerHeadline || "",
        preferredMeetupSpot: profileResponse.data.preferredMeetupSpot || "",
        favoriteCategories: (profileResponse.data.favoriteCategories || []).join(", "),
      });
    }
  }

  useEffect(() => {
    loadProfile().catch(() => setNotice({ tone: "safety", title: "Could not load profile", description: "Try refreshing the page once the backend is reachable again." }));
  }, [profileId, auth.accessToken, auth.overrideSecret, auth.devEmail, isOwnProfile]);

  useEffect(() => {
    if (!notice || notice.tone === "safety" || busyId) return undefined;
    const timer = window.setTimeout(() => setNotice((current) => (current === notice ? null : current)), 3000);
    return () => window.clearTimeout(timer);
  }, [notice, busyId]);

  const visibleListings = useMemo(
    () => (activeTab === "all" ? listings : listings.filter((item) => item.status === activeTab)),
    [listings, activeTab],
  );

  const listingMetrics = useMemo(() => {
    const activeListings = listings.filter((item) => item.status === "active").length;
    const soldListings = listings.filter((item) => item.status === "sold").length;
    const averageTrust = listings.length
      ? Math.round(listings.reduce((sum, item) => sum + Number(item.trustScore || 40), 0) / listings.length)
      : 40;

    if (!showOwnTools) {
      return [
        { label: "Live listings", value: String(activeListings), detail: "public items currently visible", tone: "selling" },
        { label: "Sold", value: String(soldListings), detail: "completed listing state changes", tone: "neutral" },
        { label: "Verified", value: profile?.isVerified ? "Yes" : "No", detail: "identity and trust signal", tone: "buying" },
        { label: "Average trust", value: `${averageTrust}/100`, detail: "listing trust average across this profile", tone: "neutral" },
      ];
    }

    return [
      { label: "Live listings", value: String(activeListings), detail: "public items currently visible", tone: "selling" },
      { label: "Sold", value: String(soldListings), detail: "completed listing state changes", tone: "neutral" },
      { label: "Unread alerts", value: String(notifications.filter((item) => !item.readAt).length), detail: "watch safety and seller updates", tone: "buying" },
      { label: "Average trust", value: `${averageTrust}/100`, detail: "listing trust average across this profile", tone: "neutral" },
    ];
  }, [showOwnTools, listings, notifications, profile?.isVerified]);

  async function saveProfile() {
    setBusyId("profile");
    setNotice({ tone: "buying", title: "Saving profile", description: "Updating the campus profile card buyers and classmates will see." });
    try {
      const response = await apiFetch(`/profiles/${profileId}`, auth, {
        method: "PATCH",
        body: {
          ...draft,
          contactNumber: sanitizeContactNote(draft.contactNumber),
          favoriteCategories: draft.favoriteCategories.split(",").map((item) => item.trim()).filter(Boolean),
          setupCompleted: true,
        },
      });
      setProfile(response.data);
      if (isOwnProfile) {
        setAuth((current) => ({ ...current, profile: response.data }));
      }
      setNotice({ tone: "selling", title: "Profile saved", description: "Your editable profile and public-facing details are in sync now." });
    } catch (error) {
      setNotice({ tone: "safety", title: "Could not save profile", description: error.message || "Check the form values and try again." });
    } finally {
      setBusyId("");
    }
  }

  async function runListingAction(listing, action) {
    const listingId = listing.id;
    setBusyId(`${action}-${listingId}`);
    const copy = actionCopy(action);

    const patchFallback = {
      "mark-sold": { status: "sold" },
      relist: { status: "active" },
      archive: { status: "hidden" },
    };
    setNotice({ tone: action === "delete" ? "safety" : "buying", title: copy.pending, description: `${listing.title} is being updated in your listing studio.` });

    try {
      if (action === "delete") {
        await apiFetch(`/listings/${listingId}`, auth, { method: "DELETE" });
      } else if (action === "duplicate") {
        try {
          await apiFetch(`/listings/${listingId}/duplicate`, auth, { method: "POST" });
        } catch (error) {
          const routeMissing = error?.code === "NOT_FOUND" || /route not found/i.test(error?.message || "");
          if (!routeMissing) throw error;
          const sourceResponse = await apiFetch(`/listings/${listingId}`, auth, { bypassCache: true });
          await apiFetch("/listings", auth, {
            method: "POST",
            body: buildDuplicatePayload(sourceResponse.data || listing),
          });
        }
      } else {
        try {
          await apiFetch(`/listings/${listingId}/${action}`, auth, { method: "POST" });
        } catch (error) {
          const routeMissing = error?.code === "NOT_FOUND" || /route not found/i.test(error?.message || "");
          if (!routeMissing || !patchFallback[action]) throw error;
          await apiFetch(`/listings/${listingId}`, auth, {
            method: "PATCH",
            body: patchFallback[action],
          });
        }
      }

      await loadProfile();
      setNotice({ tone: "selling", title: copy.success, description: `${listing.title} has been refreshed in your listing studio.` });
    } catch (error) {
      setNotice({ tone: "safety", title: "Could not update listing", description: error.message || "The listing action did not finish successfully." });
    } finally {
      setBusyId("");
    }
  }

  async function exportProfile() {
    try {
      setNotice({ tone: "buying", title: "Preparing profile export", description: "Building the latest trust snapshot into a downloadable file." });
      try {
        await downloadApiFile(`/profiles/${profileId}/export-pdf`, auth, `unikart-seller-${profileId}.pdf`);
      } catch {
        await downloadProfilePdfFallback({ profile, listings, analytics });
      }
      setNotice({ tone: "selling", title: "Profile PDF downloaded", description: "The latest profile packet has been generated successfully." });
    } catch (error) {
      setNotice({ tone: "safety", title: "Could not export profile", description: error.message || "Try again once the export route is reachable." });
    }
  }

  async function updateNotificationPreference(key, value) {
    const next = { ...(notificationPreferences || {}), [key]: value };
    setNotificationPreferences(next);
    try {
      const response = await apiFetch("/users/notification-preferences", auth, {
        method: "PATCH",
        body: { [key]: value },
      });
      setNotificationPreferences(response.data || next);
      await refreshNotifications();
    } catch {
      setNotificationPreferences((current) => ({ ...(current || {}), [key]: !value }));
      setNotice({ tone: "safety", title: "Could not update notification preferences", description: "Your toggle was reset because the backend did not accept the change." });
    }
  }

  function handleToggleCompare(listingId) {
    const nextActive = !compareIds.includes(listingId);
    const nextQueue = getNextCompareQueue(compareIds, listingId);
    toggleCompareListing(listingId);
    if (nextActive && nextQueue.length >= 2) {
      openCompareOverlay();
      setNotice({ tone: "buying", title: "Compare ready", description: "Open the overlay to review the shortlist snapshot." });
      return;
    }
    setNotice({ tone: "buying", title: nextActive ? "Added to compare" : "Removed from compare", description: "The shortlist updated immediately in your compare tray." });
  }

  if (!profile) {
    return <div className="v2-profile-page"><PageHeader compact eyebrow="Profile" title="Loading profile" description="Pulling trust details and active listings." /></div>;
  }

  return (
    <div className="v2-profile-page">
      <PageHeader
        compact
        eyebrow={isPublicPreview ? "Public preview" : showOwnTools ? "My profile" : "Campus profile"}
        title={profile.fullName}
        description={
          isPublicPreview
            ? "This is the cleaner public-facing view classmates and buyers get, without your edit controls."
            : showOwnTools
              ? "Your listing studio, buyer-side preferences, profile editing, and public preview now stay in one calmer workspace."
              : "See trust details, seller context, and active inventory without guesswork."
        }
        actions={
          <>
            <Button variant="secondary" onClick={exportProfile}>Download PDF</Button>
            {showOwnTools ? <Button variant="ghost" href={`/profiles/${profileId}?view=public`}>Preview public card</Button> : null}
            {isPublicPreview ? <Button href={`/profiles/${profileId}`}>Back to edit</Button> : showOwnTools ? <Button href="/sell">Create listing</Button> : <Button href="/messages">Message seller</Button>}
          </>
        }
      />

      {notice ? <NoticeBanner tone={notice.tone} title={notice.title} description={notice.description} /> : null}

      <section className="v2-dashboard-hero">
        <div className="v2-dashboard-hero-copy">
          <div className="v2-stack-inline">
            <StatusPill tone={profile.isVerified ? "selling" : "neutral"}>{profile.isVerified ? "verified" : "verification pending"}</StatusPill>
            <StatusPill tone="buying">{profile.responseReliability || "new"} response profile</StatusPill>
            <StatusPill tone="neutral">{profile.profileCompleteness ?? 40}% complete</StatusPill>
          </div>
          <h2>{profile.sellerHeadline || profile.bio || "Campus marketplace member"}</h2>
          <p>{profile.preferredMeetupSpot || "Add a meetup preference so buyers know where the handoff is likely to happen."}</p>
        </div>
        <div className="v2-dashboard-hero-metrics">
          {listingMetrics.slice(0, 3).map((metric) => (
            <div key={metric.label} className="v2-fact-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="v2-metric-grid v2-metric-grid-wide">
        {listingMetrics.map((metric) => (
          <MetricTile key={metric.label} {...metric} />
        ))}
      </div>

      <div className="v2-profile-shell">
        <div className="v2-profile-main">
          <Surface
            title={showOwnTools ? "Listing studio" : "Active listings"}
            description={
              showOwnTools
                ? "Manage live, draft, reserved, and sold listings without the action rows collapsing into each other, then reopen drafts in the sell studio."
                : "Review this seller's public inventory."
            }
            actions={
              showOwnTools ? (
                <div className="v2-inline-actions">
                  {compareIds.length >= 2 ? <Button variant="secondary" onClick={openCompareOverlay}>Quick compare</Button> : null}
                  {compareIds.length ? <Button variant="ghost" onClick={clearCompareQueue}>Clear compare</Button> : null}
                </div>
              ) : null
            }
          >
            {showOwnTools ? (
              <div className="v2-stack">
                <div className="v2-check-row">
                  {listingTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`v2-tab-chip ${activeTab === tab ? "v2-tab-chip-active" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab} ({tabCount(listings, tab)})
                    </button>
                  ))}
                </div>

                {visibleListings.length ? (
                  <div className="v2-profile-listing-grid">
                    {visibleListings.map((listing) => (
                      <article key={listing.id} className="v2-profile-manage-card">
                        <div className="v2-profile-card-top">
                          <div>
                            <div className="v2-stack-inline">
                              <StatusPill tone={listing.status === "sold" ? "neutral" : listing.status === "active" ? "selling" : "buying"}>
                                {listing.status || "active"}
                              </StatusPill>
                              <StatusPill tone="buying">{listing.trustScore ?? 40}/100 trust</StatusPill>
                            </div>
                            <strong>{listing.title}</strong>
                            <span>{formatCurrency(listing.price)} | {listing.area || "Campus"} | {formatLabel(listing.mode, "sale")}</span>
                          </div>
                          <small>{listing.updatedAt ? `Updated ${new Date(listing.updatedAt).toLocaleDateString("en-IN")}` : "Fresh listing"}</small>
                        </div>

                        <div className="v2-profile-card-meta">
                          <span>{formatLabel(listing.condition, "good")}</span>
                          <span>{listing.inventoryCount || 1} available</span>
                          <span>{listing.negotiable ? "Negotiable" : "Fixed price"}</span>
                        </div>

                        <div className="v2-profile-card-actions">
                          {listing.status === "draft" ? (
                            <Link href={`/sell?draft=${listing.id}`} className="v2-card-icon-button">Edit draft</Link>
                          ) : (
                            <Link href={`/listings/${listing.id}`} className="v2-card-icon-button">Open</Link>
                          )}
                          <button type="button" className={`v2-card-icon-button ${compareIds.includes(listing.id) ? "v2-card-icon-button-active" : ""}`} onClick={() => handleToggleCompare(listing.id)}>
                            {compareIds.includes(listing.id) ? "Compared" : "Compare"}
                          </button>
                          {listing.status === "draft" ? (
                            <Link href={`/sell?draft=${listing.id}`} className="v2-card-icon-button">Finish draft</Link>
                          ) : listing.status !== "sold" ? (
                            <button type="button" className="v2-card-icon-button" onClick={() => runListingAction(listing, "mark-sold")} disabled={busyId === `mark-sold-${listing.id}`}>Mark sold</button>
                          ) : (
                            <button type="button" className="v2-card-icon-button" onClick={() => runListingAction(listing, "relist")} disabled={busyId === `relist-${listing.id}`}>Relist</button>
                          )}
                          <button type="button" className="v2-card-icon-button" onClick={() => runListingAction(listing, "duplicate")} disabled={busyId === `duplicate-${listing.id}`}>Duplicate</button>
                          <button type="button" className="v2-card-icon-button" onClick={() => runListingAction(listing, "archive")} disabled={busyId === `archive-${listing.id}`}>Archive</button>
                          <button type="button" className="v2-card-icon-button" onClick={() => runListingAction(listing, "delete")} disabled={busyId === `delete-${listing.id}`}>Delete</button>
                        </div>
                        {pendingActionForListing(busyId, listing.id) ? <p className="v2-profile-card-status">{actionCopy(pendingActionForListing(busyId, listing.id)).pending}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock title="No listings in this state" description="Switch tabs or create a new listing to populate this workspace." />
                )}
              </div>
            ) : listings.length ? (
              <div className="v2-inline-list">
                {listings.filter((item) => item.status === "active").map((listing) => (
                  <Link key={listing.id} href={`/listings/${listing.id}`} className="v2-link-row">
                    <div>
                      <strong>{listing.title}</strong>
                      <span>{formatCurrency(listing.price)} | {listing.area || "Campus"} | {listing.mode || "sale"}</span>
                    </div>
                    <small>trust {listing.trustScore ?? 40}/100</small>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No active listings" description="This profile does not currently have live public inventory." />
            )}
          </Surface>

          {showOwnTools ? (
            <Surface title="Campus profile" description="Edit the public card buyers read before they ever message you, then preview it without leaving this workspace.">
              <div className="v2-profile-form-grid">
                <label className="v2-field"><span>Full name</span><input value={draft.fullName} onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))} /></label>
                <label className="v2-field"><span>Seller headline</span><input value={draft.sellerHeadline} onChange={(event) => setDraft((current) => ({ ...current, sellerHeadline: event.target.value }))} /></label>
                <label className="v2-field"><span>Meetup spot</span><input value={draft.preferredMeetupSpot} onChange={(event) => setDraft((current) => ({ ...current, preferredMeetupSpot: event.target.value }))} /></label>
                <label className="v2-field"><span>Contact note</span><input value={draft.contactNumber} onChange={(event) => setDraft((current) => ({ ...current, contactNumber: event.target.value }))} placeholder="Kept private inside the app" /></label>
                <label className="v2-field"><span>Hostel</span><input value={draft.hostel} onChange={(event) => setDraft((current) => ({ ...current, hostel: event.target.value }))} /></label>
                <label className="v2-field"><span>Department</span><input value={draft.department} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))} /></label>
              </div>
              <label className="v2-field"><span>Favorite categories</span><input value={draft.favoriteCategories} onChange={(event) => setDraft((current) => ({ ...current, favoriteCategories: event.target.value }))} /></label>
              <label className="v2-field"><span>Bio</span><textarea rows={4} value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} /></label>
              <div className="v2-page-header-actions">
                <Button onClick={saveProfile} disabled={busyId === "profile"}>{busyId === "profile" ? "Saving..." : "Save profile"}</Button>
                <Button variant="ghost" href={`/profiles/${profileId}?view=public`}>Preview public card</Button>
              </div>
              <div className="v2-profile-preview-card">
                <div className="v2-profile-preview-head">
                  <div className="v2-stack-inline">
                    <StatusPill tone={profile.isVerified ? "selling" : "neutral"}>{profile.isVerified ? "verified" : "member"}</StatusPill>
                    <StatusPill tone="buying">public card</StatusPill>
                  </div>
                  <strong>{draft.fullName || profile.fullName}</strong>
                  <p>{draft.sellerHeadline || draft.bio || "Campus marketplace member"}</p>
                </div>
                <div className="v2-profile-preview-facts">
                  <span>Meetup default: {draft.preferredMeetupSpot || "Not set yet"}</span>
                  <span>Hostel: {draft.hostel || "Not shared"}</span>
                  <span>Department: {draft.department || "Not shared"}</span>
                  <span>Favorite categories: {draft.favoriteCategories || "Not set yet"}</span>
                </div>
              </div>
            </Surface>
          ) : null}

          {showOwnTools ? (
            <Surface title="Recently viewed" description="Fast return paths for listings you opened recently.">
              {recentlyViewed.length ? (
                <div className="v2-inline-list">
                  {recentlyViewed.slice(0, 6).map((item) => (
                    <Link key={item.id} href={`/listings/${item.listingId}`} className="v2-link-row">
                      <div>
                        <strong>{item.title || "Campus listing"}</strong>
                        <span>{item.area || "Campus"} | viewed {new Date(item.viewedAt).toLocaleDateString("en-IN")}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyBlock title="Nothing viewed yet" description="Viewed listings will appear here once you browse through the marketplace." />
              )}
            </Surface>
          ) : null}
        </div>

        <aside className="v2-profile-side">
          {!showOwnTools ? (
          <Surface title="Trust snapshot" description="Core credibility, meetup, and category details in one readable block.">
            <div className="v2-checklist">
              <span>Campus: {profile.campusId}</span>
              <span>Hostel: {profile.hostel || "Not shared"}</span>
              <span>Department: {profile.department || "Not shared"}</span>
              <span>Meetup default: {profile.preferredMeetupSpot || "Not set"}</span>
              <span>Favorite categories: {(profile.favoriteCategories || []).join(", ") || "Not set"}</span>
            </div>
          </Surface>
          ) : null}

          {showOwnTools ? (
            <Surface title="Preferences" description="Notification and alert settings stay editable here.">
              {notificationPreferences ? (
                <div className="v2-inline-list">
                  {[
                    { key: "buying", label: "Buying notifications" },
                    { key: "selling", label: "Selling notifications" },
                    { key: "safety", label: "Safety notifications" },
                    { key: "system", label: "System notifications" },
                    { key: "savedSearchAlerts", label: "Saved search alerts" },
                  ].map((item) => (
                    <label key={item.key} className="v2-inline-row v2-inline-row-static">
                      <div>
                        <strong>{item.label}</strong>
                        <span>Change this preference directly from your profile.</span>
                      </div>
                      <input type="checkbox" className="v2-toggle" checked={Boolean(notificationPreferences[item.key])} onChange={(event) => updateNotificationPreference(item.key, event.target.checked)} />
                    </label>
                  ))}
                </div>
              ) : (
                <EmptyBlock title="Preferences unavailable" description="Notification controls will appear here once the backend responds." />
              )}
            </Surface>
          ) : null}

          {showOwnTools && analytics?.seller ? (
            <Surface title="Listing performance" description="A compact seller view of traction and coordination.">
              <div className="v2-inline-list">
                {analytics.seller.listingBreakdown?.slice(0, 5).map((item) => (
                  <div key={item.listingId} className="v2-inline-row">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.favoriteCount} saves | {item.conversationCount} chats | {item.scheduleCount} meetups</span>
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          ) : null}

          {showOwnTools ? (
            <Surface title="Blocked users" description="Support and safety actions remain visible here.">
              {blockedUsers.length ? (
                <div className="v2-inline-list">
                  {blockedUsers.map((item) => (
                    <div key={item.id} className="v2-inline-row">
                      <div>
                        <strong>{item.blockedProfile?.fullName || item.blockedProfileId}</strong>
                        <span>Blocked from direct interaction.</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock title="No blocked users" description="Blocked users will appear here when safety actions are taken." />
              )}
            </Surface>
          ) : null}

          <Surface title="Quick links" description="Quick access to account tools.">
            <div className="v2-utility-grid">
              <Link href="/notifications" className="v2-tool-link"><strong>Notifications</strong><span>Review buying, selling, and safety updates.</span></Link>
              <Link href="/messages" className="v2-tool-link"><strong>Messages</strong><span>Conversations, offers, and transaction follow-through.</span></Link>
              <Link href="/schedules" className="v2-tool-link"><strong>Meetups</strong><span>Upcoming and completed handoffs.</span></Link>
              <Link href="/favorites" className="v2-tool-link"><strong>Saved listings</strong><span>Shortlist, compare, and price changes.</span></Link>
            </div>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
