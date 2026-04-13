"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, Icon, StatusPill } from "@/components/system/primitives";
import { apiFetch, formatCurrency, loadCompareListings } from "@/lib/api";
import { pickBestComparePair } from "@/lib/compare";

function getListingImage(listing) {
  return listing?.imageUrls?.[0] || null;
}

function getListingValue(listing, key) {
  if (!listing) return "Unavailable";

  const valueMap = {
    price: formatCurrency(listing.price),
    trust: `${listing.trustScore ?? 40}/100`,
    seller: listing.seller?.fullName || "Campus seller",
    response: listing.seller?.responseReliability || "new",
    condition: String(listing.condition || "good").replaceAll("_", " "),
    mode: String(listing.mode || "sale"),
    area: listing.area || "Campus",
    inventory: `${listing.inventoryCount || 1} available`,
    negotiable: listing.negotiable ? "Yes" : "No",
    fulfillment: (listing.fulfillmentModes || []).join(", ") || "meetup",
    brand: listing.listingMetadata?.brand || "Not specified",
    included: listing.listingMetadata?.includedItems || "Not specified",
    meetup: listing.listingMetadata?.meetupNotes || listing.seller?.preferredMeetupSpot || "Confirm in chat",
    updated: listing.updatedAt ? new Date(listing.updatedAt).toLocaleDateString("en-IN") : "Recently added",
  };

  return valueMap[key] || "Not specified";
}

function getComparisonRows() {
  return [
    { key: "price", label: "Price", emphasis: true },
    { key: "trust", label: "Trust", emphasis: true },
    { key: "seller", label: "Seller" },
    { key: "response", label: "Response profile" },
    { key: "condition", label: "Condition" },
    { key: "mode", label: "Mode" },
    { key: "area", label: "Area" },
    { key: "inventory", label: "Availability" },
    { key: "negotiable", label: "Negotiable" },
    { key: "fulfillment", label: "Fulfillment" },
    { key: "brand", label: "Brand" },
    { key: "included", label: "Included items" },
    { key: "meetup", label: "Meetup notes" },
    { key: "updated", label: "Updated" },
  ];
}

function getAngleCopy(listing, cheapestId, strongestTrustId) {
  if (!listing) return { title: "Campus option", body: "Compare with a second listing to see which fit is stronger." };
  if (listing.id === cheapestId && listing.id === strongestTrustId) {
    return { title: "Best all-round pick", body: "This one is currently strongest on both price and trust." };
  }
  if (listing.id === cheapestId) {
    return { title: "Value pick", body: "This option is currently the cheaper path without dropping out of the shortlist." };
  }
  if (listing.id === strongestTrustId) {
    return { title: "Trust pick", body: "This option carries the stronger visible trust signal right now." };
  }
  return { title: "Balanced alternative", body: "This option is worth keeping if the details or handoff terms fit better." };
}

function getOneItemChecklist() {
  return [
    "Add another listing in the same category or price band.",
    "Use compare after you shortlist two realistic options.",
    "Keep one value pick and one trust pick when possible.",
  ];
}

export function V2CompareOverlay({ open, onClose }) {
  const { auth, compareIds, toggleCompareListing, clearCompareQueue, signedInLike, refreshCart } = useV2AppState();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissReady, setDismissReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setDismissReady(false);
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === "Escape") onClose?.();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);
    const timer = window.setTimeout(() => setDismissReady(true), 180);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
      window.clearTimeout(timer);
      setDismissReady(false);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, compareIds, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  const pair = useMemo(() => pickBestComparePair(listings), [listings]);
  const comparisonReady = pair.length >= 2;
  const cheapest = useMemo(
    () => (listings.length ? [...listings].sort((left, right) => Number(left.price || 0) - Number(right.price || 0))[0] : null),
    [listings],
  );
  const strongestTrust = useMemo(
    () => (listings.length ? [...listings].sort((left, right) => Number(right.trustScore || 40) - Number(left.trustScore || 40))[0] : null),
    [listings],
  );
  const left = pair[0] || listings[0] || null;
  const right = pair[1] || null;
  const rows = useMemo(() => getComparisonRows(), []);
  const leftAngle = getAngleCopy(left, cheapest?.id, strongestTrust?.id);
  const rightAngle = getAngleCopy(right, cheapest?.id, strongestTrust?.id);

  async function addToCart(listingId) {
    if (!signedInLike) {
      setMessage("Sign in to move compare picks into cart.");
      return;
    }

    try {
      await apiFetch("/cart/items", auth, {
        method: "POST",
        body: { listingId, quantity: 1 },
      });
      await refreshCart({ bypassCache: true });
      setMessage("Added to cart.");
    } catch (error) {
      setMessage(error.message || "Could not add that listing to cart.");
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="v2-modal-scrim"
        aria-label="Close compare"
        onClick={() => {
          if (!dismissReady) return;
          onClose?.();
        }}
      />
      <section
        className={`v2-modal-panel v2-compare-overlay ${comparisonReady ? "v2-compare-overlay-ready" : "v2-compare-overlay-compact"}`}
        aria-label="Quick compare"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="v2-compare-overlay-head">
          <div className="v2-compare-overlay-copy">
            <p className="v2-eyebrow">Quick Compare</p>
            <h2>{comparisonReady ? "Decision board" : "Build your compare pair"}</h2>
            <p>
              {comparisonReady
                ? "Compare the two strongest shortlist candidates side by side before you message, negotiate, or move one listing forward."
                : "Shortlist one more relevant listing and this turns into a proper comparison board with price, trust, seller, fulfillment, and meetup context."}
            </p>
          </div>
          <div className="v2-page-header-actions">
            {comparisonReady ? <Button href="/compare" variant="secondary">Full compare page</Button> : null}
            <Button variant="ghost" onClick={clearCompareQueue} disabled={!compareIds.length}>Clear</Button>
            <button type="button" className="v2-icon-button" aria-label="Close compare" onClick={onClose}>
              <Icon name="close" />
              <span className="v2-sr-only">Close compare</span>
            </button>
          </div>
        </header>

        {message ? <p className="v2-summary-note">{message}</p> : null}

        <div className="v2-compare-overlay-metrics">
          <div className="v2-fact-card"><span>Shortlist</span><strong>{compareIds.length}/3</strong></div>
          <div className="v2-fact-card"><span>Best price</span><strong>{cheapest ? formatCurrency(cheapest.price) : "Waiting"}</strong></div>
          <div className="v2-fact-card"><span>Strongest trust</span><strong>{strongestTrust ? `${strongestTrust.trustScore ?? 40}/100` : "Waiting"}</strong></div>
        </div>

        {loading ? (
          <div className="v2-compare-loading-strip">
            {[0, 1].map((item) => <div key={item} className="v2-skeleton-card" />)}
          </div>
        ) : null}

        {!loading && listings.length ? (
          <div className="v2-compare-shortlist-row">
            {listings.map((listing) => (
              <article key={listing.id} className={`v2-compare-chip-card ${pair.find((item) => item.id === listing.id) ? "v2-compare-chip-card-active" : ""}`}>
                <div>
                  <strong>{listing.title}</strong>
                  <span>{formatCurrency(listing.price)} | {listing.area || "Campus"} | trust {listing.trustScore ?? 40}/100</span>
                </div>
                <button type="button" className="v2-card-icon-button" onClick={() => toggleCompareListing(listing.id)}>Remove</button>
              </article>
            ))}
          </div>
        ) : null}

        {!loading && !comparisonReady && left ? (
          <div className="v2-compare-overlay-empty-state">
            <article className="v2-compare-staged-card">
              {getListingImage(left) ? <img src={getListingImage(left)} alt={left.title} className="v2-compare-image" /> : null}
              <div className="v2-stack">
                <div className="v2-stack-inline">
                  <StatusPill tone="neutral">{left.category || "Campus listing"}</StatusPill>
                  <StatusPill tone="buying">{left.trustScore ?? 40}/100 trust</StatusPill>
                </div>
                <strong>{left.title}</strong>
                <span className="v2-summary-note">{left.description}</span>
              </div>
            </article>

            <div className="v2-compare-empty-guide">
              <EmptyBlock
                title="One more listing needed"
                description="The compare board works best when the second listing is in the same category or budget range."
                action={<Button href="/marketplace">Browse listings</Button>}
              />
              <div className="v2-checklist">
                {getOneItemChecklist().map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && comparisonReady ? (
          <>
            <div className="v2-compare-overlay-snapshot">
              {[left, right].map((listing, index) => {
                const angle = index === 0 ? leftAngle : rightAngle;
                return (
                  <article key={listing.id} className="v2-compare-spotlight-card">
                    {getListingImage(listing) ? <img src={getListingImage(listing)} alt={listing.title} className="v2-compare-image" /> : null}
                    <div className="v2-stack">
                      <div className="v2-stack-inline">
                        <StatusPill tone="neutral">{listing.category || "Campus listing"}</StatusPill>
                        <StatusPill tone="buying">{angle.title}</StatusPill>
                      </div>
                      <strong>{listing.title}</strong>
                      <span className="v2-summary-note">{angle.body}</span>
                    </div>
                    <div className="v2-compare-row-grid">
                      {rows.slice(0, 6).map((row) => (
                        <div key={`${listing.id}-${row.key}`} className={`v2-compare-row ${row.emphasis ? "v2-compare-row-emphasis" : ""}`}>
                          <span>{row.label}</span>
                          <strong>{getListingValue(listing, row.key)}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="v2-inline-actions">
                      <Button href={`/listings/${listing.id}`} variant="secondary">Open listing</Button>
                      <Button variant="ghost" onClick={() => addToCart(listing.id)}>Add to cart</Button>
                      <Button variant="ghost" onClick={() => toggleCompareListing(listing.id)}>Remove</Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <section className="v2-compare-matrix">
              <div className="v2-compare-matrix-head">
                <div>
                  <p className="v2-eyebrow">Field-by-Field</p>
                  <h3>Relevant details</h3>
                </div>
                <span className="v2-summary-note">The board focuses on the fields that usually decide a campus purchase faster.</span>
              </div>
              <div className="v2-compare-table">
                <div className="v2-compare-table-header">
                  <span>Field</span>
                  <strong>{left.title}</strong>
                  <strong>{right.title}</strong>
                </div>
                {rows.map((row) => (
                  <div key={row.key} className={`v2-compare-table-row ${row.emphasis ? "v2-compare-table-row-emphasis" : ""}`}>
                    <span>{row.label}</span>
                    <strong>{getListingValue(left, row.key)}</strong>
                    <strong>{getListingValue(right, row.key)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!loading && !compareIds.length ? (
          <EmptyBlock
            title="Compare queue is empty"
            description="Pick listings from browse, favorites, or your own inventory to start a cleaner side-by-side decision board."
            action={<Button href="/marketplace">Browse listings</Button>}
          />
        ) : null}
      </section>
    </>
  );
}
