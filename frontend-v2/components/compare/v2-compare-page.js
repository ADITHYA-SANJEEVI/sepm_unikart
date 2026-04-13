"use client";

import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch, formatCurrency, loadCompareListings } from "@/lib/api";

function fitLabel(listing, cheapestId, trustId) {
  if (listing.id === cheapestId && listing.id === trustId) return "Best price and strongest trust";
  if (listing.id === cheapestId) return "Lowest current price";
  if (listing.id === trustId) return "Strongest trust signal";
  if (listing.mode === "rent") return "Best short-term fit";
  return "Balanced shortlist option";
}

export function V2ComparePage() {
  const {
    auth,
    compareIds,
    toggleCompareListing,
    clearCompareQueue,
    syncCompareQueue,
    signedInLike,
    refreshCart,
  } = useV2AppState();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!compareIds.length) {
      setListings([]);
      return;
    }
    setLoading(true);
    loadCompareListings(compareIds, auth, { cacheMs: 60000 })
      .then((items) => {
        setListings(items);
      })
      .catch(() => {
        setListings([]);
        setMessage("Could not load compare data right now.");
      })
      .finally(() => setLoading(false));
  }, [compareIds, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  const availableIds = useMemo(() => listings.map((item) => item.id), [listings]);
  const missingIds = useMemo(() => compareIds.filter((id) => !availableIds.includes(id)), [compareIds, availableIds]);
  const cheapest = useMemo(
    () => (listings.length ? [...listings].sort((a, b) => (a.price || 0) - (b.price || 0))[0] : null),
    [listings],
  );
  const highestTrust = useMemo(
    () => (listings.length ? [...listings].sort((a, b) => (b.trustScore || 40) - (a.trustScore || 40))[0] : null),
    [listings],
  );

  async function addToCart(listingId) {
    if (!signedInLike) {
      setMessage("Sign in to add items to cart.");
      return;
    }

    try {
      await apiFetch("/cart/items", auth, {
        method: "POST",
        body: { listingId, quantity: 1 },
      });
      await refreshCart({ bypassCache: true });
      setMessage("Added to cart. Open cart from the header any time.");
    } catch (error) {
      setMessage(error.message || "Could not add that listing to cart.");
    }
  }

  function pruneUnavailable() {
    syncCompareQueue(availableIds);
    setMessage(missingIds.length ? "Removed unavailable listings from compare." : "Compare queue is already clean.");
  }

  if (!compareIds.length) {
    return (
      <div className="v2-compare-page">
        <PageHeader
          compact
          eyebrow="Compare"
          title="Build a shortlist worth comparing."
          description="Compare your shortlisted items."
          actions={<Button href="/marketplace">Browse Listings</Button>}
        />
        <EmptyBlock title="No listings in compare yet" description="Add listings from browse or listing detail to start a clean shortlist." />
      </div>
    );
  }

  return (
    <div className="v2-compare-page">
      <PageHeader
        compact
        eyebrow="Compare"
        title={`Compare ${listings.length || compareIds.length} listing${(listings.length || compareIds.length) === 1 ? "" : "s"}`}
        description="Review price, trust, condition, and availability side by side before you move forward."
        actions={
          <>
            <Button href="/marketplace" variant="secondary">Add more</Button>
            <Button onClick={clearCompareQueue} variant="ghost">Clear compare</Button>
          </>
        }
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-metric-grid">
        <div className="v2-fact-card"><span>Shortlist size</span><strong>{compareIds.length}</strong></div>
        <div className="v2-fact-card"><span>Lowest price</span><strong>{cheapest ? `${cheapest.title} / ${formatCurrency(cheapest.price)}` : "Waiting for live data"}</strong></div>
        <div className="v2-fact-card"><span>Strongest trust</span><strong>{highestTrust ? `${highestTrust.title} / ${highestTrust.trustScore ?? 40}/100` : "Waiting for live data"}</strong></div>
      </div>

      {missingIds.length ? (
        <Surface
          title="Some shortlist items changed state"
          description="One or more compared items are no longer public, sold, or unavailable for side-by-side review."
          actions={<Button variant="secondary" onClick={pruneUnavailable}>Remove unavailable</Button>}
        >
          <div className="v2-checklist">
            <span>{missingIds.length} shortlist item{missingIds.length === 1 ? "" : "s"} can no longer be compared.</span>
          </div>
        </Surface>
      ) : null}

      {loading ? (
        <Surface title="Refreshing shortlist" description="Loading live listing truth for your compare board.">
          <div className="v2-compare-skeleton-grid">
            {[0, 1].map((item) => <div key={item} className="v2-skeleton-card" />)}
          </div>
        </Surface>
      ) : null}

      {listings.length ? (
        <div className="v2-card-grid">
          {listings.map((listing) => (
            <Surface key={listing.id} className="v2-compare-card">
              <div className="v2-compare-card-head">
                <div className="v2-stack">
                  {listing.imageUrls?.[0] ? <img src={listing.imageUrls[0]} alt={listing.title} className="v2-compare-image" /> : null}
                  <div className="v2-stack-inline">
                    <StatusPill tone="neutral">{listing.category || "Campus listing"}</StatusPill>
                    <StatusPill tone="buying">{listing.trustScore ?? 40}/100 trust</StatusPill>
                  </div>
                  <strong>{listing.title}</strong>
                  <p className="v2-summary-note">{fitLabel(listing, cheapest?.id, highestTrust?.id)}</p>
                </div>
                <button type="button" className="v2-card-icon-button" onClick={() => toggleCompareListing(listing.id)}>
                  Remove
                </button>
              </div>

              <div className="v2-compare-board">
                <div className="v2-fact-card"><span>Price</span><strong>{formatCurrency(listing.price)}</strong></div>
                <div className="v2-fact-card"><span>Condition</span><strong>{String(listing.condition || "").replaceAll("_", " ")}</strong></div>
                <div className="v2-fact-card"><span>Status</span><strong>{String(listing.status || "").replaceAll("_", " ")}</strong></div>
                <div className="v2-fact-card"><span>Area</span><strong>{listing.area || "Campus"}</strong></div>
                <div className="v2-fact-card"><span>Mode</span><strong>{String(listing.mode || "sale")}</strong></div>
                <div className="v2-fact-card"><span>Seller</span><strong>{listing.seller?.fullName || "Campus seller"}</strong></div>
              </div>

              <p className="v2-card-description">{listing.description}</p>

              <div className="v2-page-header-actions">
                <Button href={`/listings/${listing.id}`} variant="secondary">Open listing</Button>
                <Button onClick={() => addToCart(listing.id)} variant="ghost">Add to cart</Button>
              </div>
            </Surface>
          ))}
        </div>
      ) : !loading ? (
        <Surface title="Shortlist not ready yet" description="The current compare queue cannot be rendered into live listings.">
          <EmptyBlock
            title="Compare items need attention"
            description="Remove unavailable entries or rebuild the shortlist from active cards in browse."
            action={<Button onClick={pruneUnavailable}>Clean compare</Button>}
          />
        </Surface>
      ) : null}
    </div>
  );
}
