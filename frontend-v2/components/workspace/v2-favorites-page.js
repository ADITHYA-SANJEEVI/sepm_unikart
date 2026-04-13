"use client";

import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, PageHeader, Surface } from "@/components/system/primitives";
import { apiFetch } from "@/lib/api";
import { V2ListingCard } from "@/components/marketplace/v2-listing-card";
import { getNextCompareQueue } from "@/lib/compare";

export function V2FavoritesPage() {
  const { auth, signedInLike, compareIds, toggleCompareListing, clearCompareQueue, openCompareOverlay, refreshCart, cartCount } = useV2AppState();
  const [favorites, setFavorites] = useState([]);
  const [busyFavoriteId, setBusyFavoriteId] = useState("");
  const [busyCartId, setBusyCartId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadFavorites() {
    if (!signedInLike) {
      setFavorites([]);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch("/listings/favorites", auth, { cacheMs: 8000 });
      setFavorites(response.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFavorites().catch(() => setMessage("Could not load saved listings."));
  }, [signedInLike, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const totalValue = useMemo(
    () => favorites.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [favorites],
  );

  async function toggleFavorite(listing) {
    try {
      setBusyFavoriteId(listing.id);
      await apiFetch(`/listings/${listing.id}/favorite`, auth, {
        method: listing.isFavorited ? "DELETE" : "POST",
      });
      await loadFavorites();
      setMessage(listing.isFavorited ? "Removed from saved." : "Saved listing updated.");
    } catch (error) {
      setMessage(error.message || "Could not update saved listings.");
    } finally {
      setBusyFavoriteId("");
    }
  }

  async function addToCart(listing) {
    try {
      setBusyCartId(listing.id);
      await apiFetch("/cart/items", auth, {
        method: "POST",
        body: { listingId: listing.id, quantity: 1 },
      });
      await refreshCart({ bypassCache: true });
      setMessage("Added to cart. Open cart from the header any time.");
    } catch (error) {
      setMessage(error.message || "Could not add this saved listing to cart.");
    } finally {
      setBusyCartId("");
    }
  }

  async function clearAllSaved() {
    if (!favorites.length) return;
    try {
      await Promise.all(
        favorites.map((listing) =>
          apiFetch(`/listings/${listing.id}/favorite`, auth, {
            method: "DELETE",
          }).catch(() => null),
        ),
      );
      setFavorites([]);
      setMessage("Cleared saved listings.");
    } catch {
      setMessage("Could not clear saved listings.");
    }
  }

  if (!signedInLike) {
    return (
      <div className="v2-workspace-page">
        <PageHeader
          compact
          eyebrow="Saved"
          title="Sign in to view your saved items."
          description="Saved listings stay tied to compare, cart, and notifications once you sign in."
        />
      </div>
    );
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Saved"
        title="Your Saved Items"
        description="Every saved listing should still support compare, cart, and the next decision without forcing you back through search."
        actions={
          <>
            <Button href="/marketplace" variant="secondary">Browse more</Button>
            <Button variant="ghost" onClick={clearAllSaved}>Clear saved</Button>
          </>
        }
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-metric-grid">
        <MetricTile label="Saved" value={favorites.length} detail="current shortlist items" tone="buying" href="/favorites" />
        <MetricTile label="Compare" value={compareIds.length} detail="ready in compare" tone="neutral" href="/compare" />
        <MetricTile label="Cart" value={cartCount} detail="items already moved forward" tone="selling" href="/cart" />
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Saved listings" description="Shortlisted items stay live and ready for compare, cart, and reopen actions.">
          {loading ? (
            <div className="v2-card-grid">
              {[0, 1].map((item) => <div key={item} className="v2-skeleton-card" />)}
            </div>
          ) : favorites.length ? (
            <div className="v2-card-grid">
              {favorites.map((listing) => (
                <V2ListingCard
                  key={listing.id}
                  listing={listing}
                  compareActive={compareIds.includes(listing.id)}
                  onToggleCompare={() => {
                    const nextQueue = getNextCompareQueue(compareIds, listing.id);
                    const nextActive = !compareIds.includes(listing.id);
                    toggleCompareListing(listing.id);
                    if (nextActive && nextQueue.length >= 2) {
                      openCompareOverlay();
                      setMessage("Compare ready. Review the overlay snapshot.");
                    }
                  }}
                  onToggleFavorite={() => toggleFavorite(listing)}
                  onAddToCart={() => addToCart(listing)}
                  favoriteBusy={busyFavoriteId === listing.id}
                  cartBusy={busyCartId === listing.id}
                />
              ))}
            </div>
          ) : (
            <EmptyBlock title="No saved listings yet" description="Save a listing from browse or detail and it will stay manageable here." />
          )}
        </Surface>

        <Surface
          title="Shortlist controls"
          description="Review your shortlisted items."
          actions={compareIds.length ? <Button variant="ghost" onClick={clearCompareQueue}>Clear compare</Button> : null}
        >
          <div className="v2-inline-list">
            <div className="v2-inline-row">
              <div>
                <strong>Estimated shortlist value</strong>
                <span>Sum of currently saved listing prices for quick decision framing.</span>
              </div>
              <small>INR {totalValue}</small>
            </div>
            <div className="v2-inline-row">
              <div>
                <strong>Compare queue</strong>
                <span>{compareIds.length ? "Compare is ready from the header and profile menu." : "Use compare from cards to tighten the shortlist."}</span>
              </div>
              <small>{compareIds.length} active</small>
            </div>
            <div className="v2-inline-row">
              <div>
                <strong>Cart handoff</strong>
                <span>Saved items should move cleanly into cart without losing context.</span>
              </div>
              <small>{cartCount} in cart</small>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
