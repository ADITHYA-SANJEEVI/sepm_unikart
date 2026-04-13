"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button, Icon, IconButton, StatusPill } from "@/components/system/primitives";
import { formatCurrency } from "@/lib/api";

function getPrimaryAsset(listing) {
  if (listing?.mediaAssets?.length) {
    const readyAsset = listing.mediaAssets.find((item) => item.publicUrl);
    if (readyAsset?.publicUrl) return readyAsset;
  }

  if (listing?.imageUrls?.[0]) {
    return { publicUrl: listing.imageUrls[0], kind: "image" };
  }

  return null;
}

function getModeLabel(mode) {
  if (mode === "rent") return "Rent";
  if (mode === "bundle") return "Bundle";
  return "Buy";
}

function getConditionLabel(condition) {
  return String(condition || "good").replaceAll("_", " ");
}

function getTrustTone(score) {
  if (score >= 80) return "selling";
  if (score >= 60) return "buying";
  return "neutral";
}

function isVideoAsset(asset) {
  const contentType = String(asset?.contentType || asset?.mimeType || "").toLowerCase();
  const url = String(asset?.publicUrl || "").toLowerCase();
  return contentType.startsWith("video/") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov");
}

export function V2ListingCard({
  listing,
  compareActive = false,
  onToggleCompare,
  onToggleFavorite,
  onAddToCart,
  cartQuantity = 0,
  favoriteBusy = false,
  cartBusy = false,
}) {
  const primaryAsset = useMemo(() => getPrimaryAsset(listing), [listing]);
  const trustScore = listing?.trustScore ?? 40;
  const completenessScore = listing?.completenessScore ?? 0;
  const sellerLabel = listing?.seller?.fullName || "Campus seller";
  const isUnavailable = ["sold", "hidden", "suspended", "draft"].includes(listing?.status || "");
  const isVideo = isVideoAsset(primaryAsset);

  return (
    <article className={`v2-card ${compareActive ? "v2-card-compare-active" : ""}`}>
      <div className="v2-card-media-shell">
        <Link href={`/listings/${listing.id}`} className="v2-card-media">
          {primaryAsset?.publicUrl ? (
            isVideo ? (
              <div className="v2-card-video-shell">
                <video src={primaryAsset.publicUrl} className="v2-card-image" muted playsInline preload="metadata" />
                <span className="v2-card-video-chip">Video</span>
              </div>
            ) : (
              <img src={primaryAsset.publicUrl} alt={listing.title} className="v2-card-image" />
            )
          ) : (
            <div className="v2-card-image-placeholder">
              <span>{listing.category || "Campus listing"}</span>
              <strong>{listing.title}</strong>
            </div>
          )}
          <div className="v2-card-media-top">
            <StatusPill tone="neutral">{getModeLabel(listing.mode)}</StatusPill>
            <StatusPill tone={getTrustTone(trustScore)}>{trustScore}/100 trust</StatusPill>
          </div>
          <div className="v2-card-media-bottom">
            <StatusPill tone={isUnavailable ? "safety" : "neutral"}>{listing.status || "active"}</StatusPill>
            <StatusPill tone="neutral">{getConditionLabel(listing.condition)}</StatusPill>
          </div>
        </Link>

        <div className="v2-card-floating-actions">
          <IconButton
            icon="heart"
            label={listing.isFavorited ? "Remove from saved listings" : "Save listing"}
            active={Boolean(listing.isFavorited)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite?.(listing);
            }}
            disabled={favoriteBusy}
          />
          <IconButton
            icon="compare"
            label={compareActive ? "Remove from compare" : "Add to compare"}
            active={compareActive}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleCompare?.(listing);
            }}
          />
        </div>
      </div>

      <div className="v2-card-body">
        <div className="v2-card-header">
          <div className="v2-card-title-wrap">
            <span className="v2-card-category">{listing.category || "Campus"}</span>
            <Link href={`/listings/${listing.id}`} className="v2-card-title">
              {listing.title}
            </Link>
          </div>
          <div className="v2-card-price">
            <strong>{formatCurrency(listing.price)}</strong>
            <span>{listing.negotiable ? "Negotiable" : getModeLabel(listing.mode)}</span>
          </div>
        </div>

        <p className="v2-card-description">{listing.description}</p>

        <div className="v2-card-meta">
          <span>{listing.area || "Campus"}</span>
          <span>{listing.inventoryCount || 1} available</span>
          <span>{completenessScore}% complete</span>
        </div>

        <div className="v2-card-seller">
          <div>
            <strong>{sellerLabel}</strong>
            <span>{listing?.seller?.responseReliability || "new"} response profile</span>
          </div>
          <small>{listing.updatedAt ? `Updated ${new Date(listing.updatedAt).toLocaleDateString("en-IN")}` : "Fresh listing"}</small>
        </div>

        <div className="v2-card-actions">
          <Button href={`/listings/${listing.id}`} className="v2-card-primary-action">
            View
          </Button>
          <Button
            variant="secondary"
            onClick={onAddToCart}
            disabled={cartBusy || isUnavailable}
            className="v2-card-inline-action"
          >
            <Icon name="cart" />
            <span>{cartBusy ? "Adding..." : isUnavailable ? "Unavailable" : cartQuantity > 0 ? `In cart (${cartQuantity})` : "Add to cart"}</span>
          </Button>
          <Button href={`/messages?listingId=${listing.id}`} variant="ghost" className="v2-card-inline-action">
            Chat
          </Button>
        </div>
      </div>
    </article>
  );
}
