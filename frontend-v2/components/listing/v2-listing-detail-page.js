"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, NoticeBanner, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch, downloadApiFile, formatCurrency, peekApiCache, prefetchApi } from "@/lib/api";
import { getNextCompareQueue } from "@/lib/compare";
import { downloadListingPdfFallback } from "@/lib/listing-pdf";
import { TomTomCampusMap } from "@/components/workspace/tomtom-campus-map";
import { CAMPUS_SAFE_ZONES as CAMPUS_SPOTS, getSpotById } from "@/lib/safe-zones";

function getMedia(listing) {
  const assets = (listing?.mediaAssets || [])
    .filter((item) => item.publicUrl)
    .map((item) => ({
      url: item.publicUrl,
      kind: item.mediaKind || (String(item.mimeType || "").startsWith("video/") ? "video" : "image"),
    }));
  if (assets.length) return assets;
  return (listing?.imageUrls || []).filter(Boolean).map((url) => ({ url, kind: "image" }));
}

function formatLabel(value) {
  return String(value || "").replaceAll("_", " ");
}

function modePrice(listing) {
  if (listing?.mode === "rent" && listing?.rentDetails?.dailyRate) {
    return `${formatCurrency(listing.rentDetails.dailyRate)}/day`;
  }
  return formatCurrency(listing?.price || 0);
}

function cycleMediaIndex(currentIndex, length, direction) {
  if (!length) return 0;
  return (currentIndex + direction + length) % length;
}

export function V2ListingDetailPage({ listingId }) {
  const { auth, signedInLike, compareIds, toggleCompareListing, openCompareOverlay, refreshCart } = useV2AppState();
  const [listing, setListing] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    let cancelled = false;
    const listingPath = `/listings/${listingId}`;
    const similarPath = `/listings/${listingId}/similar`;
    const listingCacheOptions = { cacheMs: 600000, staleMs: 21600000 };
    const cachedListing = peekApiCache(listingPath, auth, listingCacheOptions);
    const cachedSimilar = peekApiCache(similarPath, auth, listingCacheOptions);

    if (cachedListing?.data) {
      setListing(cachedListing.data || null);
      setSimilar(cachedSimilar?.data || []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    prefetchApi(listingPath, auth, listingCacheOptions).catch(() => null);
    prefetchApi(similarPath, auth, listingCacheOptions).catch(() => null);
    Promise.all([
      apiFetch(listingPath, auth, listingCacheOptions).catch(() => ({ data: null })),
      apiFetch(similarPath, auth, listingCacheOptions).catch(() => ({ data: [] })),
    ]).then(([listingResponse, similarResponse]) => {
      if (cancelled) return;
      setListing(listingResponse.data || null);
      setSimilar(similarResponse.data || []);
      setLoading(false);
    });

    if (signedInLike) {
      apiFetch("/users/recently-viewed", auth, { method: "POST", body: { listingId } }).catch(() => null);
    }

    return () => {
      cancelled = true;
    };
  }, [listingId, auth.accessToken, auth.overrideSecret, auth.devEmail, signedInLike]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [listingId]);

  const media = useMemo(() => getMedia(listing), [listing]);
  const activeMedia = media[activeMediaIndex] || null;
  const inCompare = compareIds.includes(listing?.id);
  const unavailable = ["sold", "hidden", "suspended", "draft"].includes(listing?.status || "");

  async function toggleFavorite() {
    if (!signedInLike || !listing) {
      setMessage("Sign in to save listings.");
      return;
    }
    setBusyAction("favorite");
    const nextFavorited = !listing.isFavorited;
    setListing((current) => ({ ...current, isFavorited: nextFavorited }));
    try {
      await apiFetch(`/listings/${listing.id}/favorite`, auth, {
        method: listing.isFavorited ? "DELETE" : "POST",
        invalidatePaths: [`/listings/${listing.id}`, "/listings/favorites", "/marketplace", "/listings?"],
      });
      setMessage(nextFavorited ? "Saved listing." : "Removed from saved.");
    } catch {
      setListing((current) => ({ ...current, isFavorited: !nextFavorited }));
      setMessage("Could not update saved state.");
    } finally {
      setBusyAction("");
    }
  }

  async function addToCart() {
    if (!signedInLike || !listing) {
      setMessage("Sign in to add items to cart.");
      return;
    }
    setBusyAction("cart");
    try {
      await apiFetch("/cart/items", auth, {
        method: "POST",
        body: { listingId: listing.id, quantity: 1 },
        invalidatePaths: ["/cart"],
      });
      await refreshCart({ bypassCache: true });
      setMessage("Added to cart. Open cart from the header any time.");
    } catch (error) {
      setMessage(error.message || "Could not add to cart.");
    } finally {
      setBusyAction("");
    }
  }

  async function requestHold() {
    if (!signedInLike || !listing) {
      setMessage("Sign in to request a hold.");
      return;
    }
    setBusyAction("hold");
    try {
      await apiFetch(`/listings/${listing.id}/holds`, auth, {
        method: "POST",
        body: { hours: 24, note: "Requested from listing detail." },
        invalidatePaths: [`/listings/${listing.id}`, "/chat"],
      });
      const refreshed = await apiFetch(`/listings/${listing.id}`, auth);
      setListing(refreshed.data);
      setMessage("24-hour hold requested.");
    } catch (error) {
      setMessage(error.message || "Could not request hold.");
    } finally {
      setBusyAction("");
    }
  }

  async function downloadPdf() {
    if (!listing) return;
    setBusyAction("download");
    try {
      let filename;
      try {
        filename = await downloadApiFile(`/listings/${listing.id}/export-pdf`, auth, `unikart-listing-${listing.id}.pdf`);
      } catch {
        filename = await downloadListingPdfFallback(listing);
      }
      setMessage(`Downloaded ${filename}.`);
    } catch (error) {
      setMessage(error.message || "Could not download PDF.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return (
      <div className="v2-detail-page">
        <PageHeader compact eyebrow="Listing" title="Loading listing" description="Pulling media, seller context, and transaction state." />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="v2-detail-page">
        <EmptyBlock title="Listing unavailable" description="This listing could not be loaded or is no longer public." />
      </div>
    );
  }

  return (
    <div className="v2-detail-page">
      <PageHeader
        compact
        eyebrow={listing.mode === "rent" ? "Rental" : listing.mode === "bundle" ? "Bundle" : "Listing"}
        title={listing.title}
        description="Inspect trust, media, pricing, and the next action from one calm decision surface."
        actions={
          <>
            <Button variant="secondary" onClick={downloadPdf} loading={busyAction === "download"}>Download PDF</Button>
            <Button href={`/messages?listingId=${listing.id}`}>Message seller</Button>
          </>
        }
      />

      <section className="v2-dashboard-hero">
        <div className="v2-dashboard-hero-copy">
          <div className="v2-stack-inline">
            <StatusPill tone="neutral">{listing.category || "Campus listing"}</StatusPill>
            <StatusPill tone={unavailable ? "safety" : "selling"}>{listing.status || "active"}</StatusPill>
            <StatusPill tone="buying">{listing.trustScore ?? 40}/100 trust</StatusPill>
          </div>
          <h2>{modePrice(listing)}</h2>
          <p>{listing.description}</p>
          <div className="v2-detail-meta-row">
            <span>{listing.area || "Campus"}</span>
            <span>{listing.inventoryCount || 1} available</span>
            <span>{formatLabel(listing.condition)}</span>
            <span>{(listing.fulfillmentModes || []).join(", ") || "meetup"}</span>
          </div>
          <div className="v2-page-header-actions">
            <Button onClick={addToCart} variant="secondary" loading={busyAction === "cart"} disabled={unavailable}>
              {unavailable ? "Unavailable" : "Add to cart"}
            </Button>
            <Button onClick={requestHold} variant="secondary" loading={busyAction === "hold"} disabled={unavailable}>
              {listing.activeHold ? "Hold active" : "Request 24h hold"}
            </Button>
            <Button
              onClick={() => {
                const nextActive = !inCompare;
                const nextQueue = getNextCompareQueue(compareIds, listing.id);
                toggleCompareListing(listing.id);
                if (nextActive && nextQueue.length >= 2) {
                  openCompareOverlay();
                  setMessage("Compare ready. Review the overlay snapshot.");
                  return;
                }
                setMessage(nextActive ? "Added to compare." : "Removed from compare.");
              }}
              variant="ghost"
            >
              {inCompare ? "Remove from compare" : "Add to compare"}
            </Button>
            <Button onClick={toggleFavorite} variant="ghost" disabled={busyAction === "favorite"}>
              {listing.isFavorited ? "Saved" : "Save"}
            </Button>
          </div>
          {message ? <NoticeBanner tone="neutral" title="Listing update" description={message} className="v2-page-alert" /> : null}
        </div>

        <div className="v2-detail-media-shell">
          {activeMedia ? (
            activeMedia.kind === "video" ? (
              <video src={activeMedia.url} className="v2-detail-primary-media" controls playsInline preload="metadata" />
            ) : (
              <img src={activeMedia.url} alt={listing.title} className="v2-detail-primary-media" />
            )
          ) : (
            <div className="v2-card-image-placeholder">
              <span>{listing.category || "Campus listing"}</span>
              <strong>{listing.title}</strong>
            </div>
          )}

          {media.length > 1 ? (
            <div className="v2-detail-gallery-actions">
              <Button variant="secondary" onClick={() => setActiveMediaIndex((current) => cycleMediaIndex(current, media.length, -1))}>Previous</Button>
              <span className="v2-summary-note">Photo {activeMediaIndex + 1} of {media.length}</span>
              <Button variant="secondary" onClick={() => setActiveMediaIndex((current) => cycleMediaIndex(current, media.length, 1))}>Next</Button>
            </div>
          ) : null}

          {media.length > 1 ? (
            <div className="v2-detail-thumb-row">
              {media.map((item, index) => (
                <button
                  key={`${item.url}-${index}`}
                  type="button"
                  className={`v2-detail-thumb ${index === activeMediaIndex ? "v2-detail-thumb-active" : ""}`}
                  onClick={() => setActiveMediaIndex(index)}
                >
                  {item.kind === "video" ? (
                    <div className="v2-detail-thumb-video">
                      <video src={item.url} muted playsInline preload="metadata" />
                      <span>Video</span>
                    </div>
                  ) : (
                    <img src={item.url} alt={`${listing.title} ${index + 1}`} />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="v2-marketplace-layout v2-detail-layout">
        <div className="v2-detail-main">
          <Surface title="Decision snapshot" description="The key signals buyers usually need before they start negotiating.">
            <div className="v2-metric-grid">
              <div className="v2-fact-card"><span>Status</span><strong>{formatLabel(listing.status)}</strong></div>
              <div className="v2-fact-card"><span>Seller</span><strong>{listing.seller?.fullName || "Campus seller"}</strong></div>
              <div className="v2-fact-card"><span>Trust</span><strong>{listing.trustScore ?? 40}/100</strong></div>
            </div>
          </Surface>

          <Surface title="Description and details" description="Everything needed to understand the item before you message or meet up.">
            <div className="v2-inline-list">
              {listing.listingMetadata?.brand ? (
                <div className="v2-inline-row"><div><strong>Brand / model</strong><span>{listing.listingMetadata.brand}</span></div></div>
              ) : null}
              {listing.listingMetadata?.includedItems ? (
                <div className="v2-inline-row"><div><strong>Included</strong><span>{listing.listingMetadata.includedItems}</span></div></div>
              ) : null}
              {listing.listingMetadata?.usageHighlights ? (
                <div className="v2-inline-row"><div><strong>Usage highlights</strong><span>{listing.listingMetadata.usageHighlights}</span></div></div>
              ) : null}
              {listing.listingMetadata?.meetupNotes ? (
                <div className="v2-inline-row"><div><strong>Meetup notes</strong><span>{listing.listingMetadata.meetupNotes}</span></div></div>
              ) : null}
            </div>
          </Surface>

          <Surface title="Similar listings" description="Use nearby options to validate the shortlist without dropping back into raw search.">
            {similar.length ? (
              <div className="v2-card-grid">
                {similar.slice(0, 4).map((item) => (
                  <Link key={item.id} href={`/listings/${item.id}`} className="v2-tool-link">
                    <strong>{item.title}</strong>
                    <span>{formatCurrency(item.price)} / trust {item.trustScore ?? 40}/100</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No close matches right now" description="Similar listings will appear here when the marketplace has nearby options." />
            )}
          </Surface>
        </div>

        <aside className="v2-detail-side">
          <Surface title="Seller and safety" description="Seller profile and activity insights.">
            <div className="v2-profile-card">
              <div>
                <strong>{listing.seller?.fullName || "Campus seller"}</strong>
                <span>{listing.seller?.sellerHeadline || listing.seller?.bio || "Verified campus profile and listing-linked coordination."}</span>
              </div>
              <div className="v2-stack">
                <StatusPill tone={listing.seller?.isVerified ? "selling" : "neutral"}>
                  {listing.seller?.isVerified ? "verified profile" : "complete seller profile"}
                </StatusPill>
                <StatusPill tone="neutral">{listing.seller?.responseReliability || "new"} response profile</StatusPill>
              </div>
            </div>
            <div className="v2-checklist">
              <span>Inspect the item before payment.</span>
              <span>Prefer visible campus meetup points.</span>
              <span>Coordinate logistics securely using the built-in chat.</span>
            </div>
            <div className="v2-page-header-actions">
              <Button href={`/profiles/${listing.seller?.id || ""}`} variant="secondary">View seller</Button>
              <Button href="/policy" variant="ghost">Safety guide</Button>
            </div>
          </Surface>

          <Surface title={listing.area || "Meetup Location"} description="Expected campus zone for handoff.">
            <div className="v2-mini-map-container" style={{ width: "100%", height: "200px", borderRadius: "12px", overflow: "hidden", position: "relative", border: "1px solid rgba(16, 42, 41, 0.12)" }} aria-label="Campus meetup location map">
              <TomTomCampusMap
                tileUrlTemplate="/api/backend/maps/tiles/{z}/{x}/{y}.png?style=street-light"
                selectedSpotId={CAMPUS_SPOTS.find(s => s.shortLabel.toLowerCase() === (listing.area || "").toLowerCase() || s.id === listing.area)?.id || null}
                spots={CAMPUS_SPOTS}
                readonly={true}
              />
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center" }}>
              {listing.area ? `Usually meets at ${listing.area}` : "Location coordinated after purchase."}
            </div>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
