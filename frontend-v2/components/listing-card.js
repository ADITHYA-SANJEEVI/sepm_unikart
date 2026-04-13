"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/api";
import { ReportListingAction } from "@/components/report-listing-action";

function getMedia(listing) {
  return (listing.imageUrls || []).filter((item) => typeof item === "string" && item.trim());
}

function getModeLabel(mode) {
  if (mode === "rent") return "Rent";
  if (mode === "bundle") return "Bundle";
  return "Buy";
}

function getMediaType(url) {
  return String(url).startsWith("data:video") || /\.(mp4|mov|webm)$/i.test(String(url)) ? "video" : "image";
}

function getTrustLabel(score) {
  if (score >= 80) return "High trust";
  if (score >= 60) return "Solid trust";
  return "Growing trust";
}

function buildReferenceCode(listingId) {
  if (!listingId) return "Ref N/A";
  return `Ref ${String(listingId).slice(0, 6).toUpperCase()}`;
}

export function ListingCard({
  listing,
  onFavorite,
  onAddToCart,
  onIncrementCart,
  onDecrementCart,
  cartQuantity = 0,
  onCompare,
  compareActive = false,
  onPrefetch,
}) {
  const media = useMemo(() => getMedia(listing), [listing]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const modeLabel = getModeLabel(listing.mode);
  const trustScore = listing.trustScore ?? 40;
  const hasMultipleMedia = media.length > 1;
  const activeMedia = media[activeIndex] || null;
  const referenceCode = buildReferenceCode(listing.id);

  const priceLabel =
    listing.mode === "rent" && listing.rentDetails?.dailyRate
      ? `${formatCurrency(listing.rentDetails.dailyRate)}/day`
      : formatCurrency(listing.price);

  const subprice =
    listing.mode === "rent"
      ? [
          listing.rentDetails?.weeklyRate ? `${formatCurrency(listing.rentDetails.weeklyRate)}/week` : null,
          listing.rentDetails?.deposit ? `Deposit ${formatCurrency(listing.rentDetails.deposit)}` : null,
        ]
          .filter(Boolean)
          .join(" | ")
      : listing.mode === "bundle"
        ? `${listing.bundleDetails?.itemCount || listing.inventoryCount || 0} item bundle`
        : listing.negotiable
          ? "Negotiable pricing"
          : "Fixed price";

  useEffect(() => {
    setActiveIndex(0);
  }, [listing.id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 1600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function previousMedia(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!hasMultipleMedia) return;
    setActiveIndex((current) => (current === 0 ? media.length - 1 : current - 1));
  }

  function nextMedia(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!hasMultipleMedia) return;
    setActiveIndex((current) => (current === media.length - 1 ? 0 : current + 1));
  }

  async function handleFavorite(event) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    try {
      await onFavorite?.(listing);
      setNotice(listing.isFavorited ? "Removed from saved" : "Saved for later");
    } finally {
      setPending(false);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    try {
      await onAddToCart?.(listing);
      setNotice("Added to cart");
    } finally {
      setPending(false);
    }
  }

  async function handleIncrement(event) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    try {
      await onIncrementCart?.(listing);
      setNotice("Cart updated");
    } finally {
      setPending(false);
    }
  }

  async function handleDecrement(event) {
    event.preventDefault();
    event.stopPropagation();
    setPending(true);
    try {
      await onDecrementCart?.(listing);
      setNotice(cartQuantity <= 1 ? "Removed from cart" : "Cart updated");
    } finally {
      setPending(false);
    }
  }

  function handleCompare(event) {
    event.preventDefault();
    event.stopPropagation();
    onCompare?.(listing);
    setNotice(compareActive ? "Removed from compare" : "Added to compare");
  }

  function handlePrefetch() {
    onPrefetch?.(listing);
  }

  return (
    <article
      className={`listing-card ${compareActive ? "listing-card-compare-active" : ""}`}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
    >
      <Link href={`/listings/${listing.id}`} className="listing-card-media">
        {activeMedia ? (
          getMediaType(activeMedia) === "video" ? (
            <video src={activeMedia} className="listing-card-image" muted playsInline />
          ) : (
            <img src={activeMedia} alt={listing.title} className="listing-card-image" />
          )
        ) : (
          <div className="listing-card-placeholder">
            <div className="listing-card-placeholder-copy">
              <span>{listing.category || "Campus item"}</span>
              <strong>{listing.title}</strong>
            </div>
          </div>
        )}

        <div className="listing-card-overlay" />

        <div className="listing-card-badges">
          <span className="badge badge-soft">{listing.condition?.replace("_", " ") || "Campus find"}</span>
          <div className="listing-card-top-badges">
            <span className="badge">{modeLabel}</span>
            {compareActive ? <span className="badge badge-compare">Compared</span> : null}
          </div>
        </div>

        <div className="listing-card-media-meta">
          <span className="badge badge-reference">{referenceCode}</span>
          <span className="badge badge-soft-ghost">
            {media.length ? `${activeIndex + 1}/${media.length}` : "No media"}
          </span>
        </div>

        <div className="card-slider-shell">
          <div className="card-slider-controls">
            <button
              type="button"
              className="card-slider-button"
              onClick={previousMedia}
              aria-label="Previous media"
              disabled={!hasMultipleMedia}
            >
              {"<"}
            </button>
            <button
              type="button"
              className="card-slider-button"
              onClick={nextMedia}
              aria-label="Next media"
              disabled={!hasMultipleMedia}
            >
              {">"}
            </button>
          </div>
          <div className="card-slider-dots">
            {(media.length ? media : [listing.id]).map((_, index) => (
              <span key={`${listing.id}-media-${index}`} className={`card-slider-dot ${index === activeIndex ? "card-slider-dot-active" : ""}`} />
            ))}
          </div>
          <span className="card-slider-count">{hasMultipleMedia ? "Swipe media" : "Preview ready"}</span>
        </div>
      </Link>

      <div className="listing-card-body">
        <div className="listing-card-main">
          <div className="listing-card-topline">
            <div className="listing-card-topline-copy">
              <span className="card-category">{listing.category || "Campus listing"}</span>
              <div className="card-meta-inline">
                <span className="mini-rating">{Math.max(4.1, trustScore / 20).toFixed(1)}</span>
                <span>{listing.area || "Campus"}</span>
              </div>
            </div>
            <div className="listing-card-trust-pill">
              <strong>{trustScore}/100</strong>
              <span>{getTrustLabel(trustScore)}</span>
            </div>
          </div>

          <div className="listing-card-title-row">
            <div className="listing-card-copy-block">
              <Link href={`/listings/${listing.id}`} className="listing-card-title">
                {listing.title}
              </Link>
              <p className="listing-card-copy">{listing.description}</p>
            </div>
            <div className="listing-card-price">
              <strong>{priceLabel}</strong>
              <span>{subprice}</span>
            </div>
          </div>

          <div className="listing-card-attributes">
            <span>{listing.status || "active"}</span>
            <span>{listing.inventoryCount || 1} available</span>
            <span>{listing.fulfillmentModes?.join(", ") || "Meetup"}</span>
            <span>{listing.completenessScore ?? 45}% complete</span>
          </div>

          <div className="listing-card-microfacts">
            <span>{listing.listingMetadata?.brand || "Campus-ready item"}</span>
            {listing.listingMetadata?.ageMonths ? <span>{listing.listingMetadata.ageMonths} months old</span> : null}
            {listing.listingMetadata?.includedItems ? <span>Accessories included</span> : null}
            {listing.activeHold ? <span>Hold active</span> : null}
          </div>
        </div>

        <div className="listing-card-footer">
          <div className="listing-card-seller">
            <Link href={`/profiles/${listing.seller?.id || ""}`} className="seller-chip">
              <span className="seller-initial">
                {String(listing.seller?.fullName || "S").trim().charAt(0).toUpperCase()}
              </span>
              <span>
                <strong>{listing.seller?.fullName || "Campus Seller"}</strong>
                <small>{listing.seller?.responseReliability || "new"} responses</small>
              </span>
            </Link>
            <span className="seller-date">
              {listing.updatedAt ? `Updated ${new Date(listing.updatedAt).toLocaleDateString("en-IN")}` : "Campus listing"}
            </span>
          </div>

          <div className="listing-card-actions">
            <button
              type="button"
              className={`save-heart-button ${listing.isFavorited ? "save-heart-button-active" : ""}`}
              onClick={handleFavorite}
              disabled={pending}
              aria-label={listing.isFavorited ? "Remove from saved listings" : "Save listing"}
            >
              <span className="save-heart-glyph" aria-hidden="true">
                {listing.isFavorited ? "♥" : "♡"}
              </span>
            </button>

            {cartQuantity > 0 ? (
              <div className="quantity-stepper listing-card-stepper" aria-label="Cart quantity">
                <button type="button" className="quantity-stepper-button" onClick={handleDecrement} disabled={pending}>
                  −
                </button>
                <span className="quantity-stepper-value">{cartQuantity}</span>
                <button
                  type="button"
                  className="quantity-stepper-button"
                  onClick={handleIncrement}
                  disabled={pending || cartQuantity >= (listing.inventoryCount || 1)}
                  title={cartQuantity >= (listing.inventoryCount || 1) ? "Only 1 available" : "Add more"}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="action-button action-button-secondary listing-card-primary-cta"
                onClick={handleAdd}
                disabled={pending || listing.status === "sold"}
              >
                {cartQuantity > 0 ? `In Cart (${cartQuantity})` : "Add to Cart"}
              </button>
            )}

            <button
              type="button"
              className={`action-button action-button-secondary ${compareActive ? "listing-card-compare-button-active" : ""}`}
              onClick={handleCompare}
            >
              {compareActive ? "Compared" : "Compare"}
            </button>

            <Link href={`/messages?listingId=${listing.id}`} className="action-button action-button-secondary">
              Chat
            </Link>

            <ReportListingAction listingId={listing.id} compact />
          </div>
        </div>

        {notice ? <p className="listing-card-feedback">{notice}</p> : null}
      </div>
    </article>
  );
}
