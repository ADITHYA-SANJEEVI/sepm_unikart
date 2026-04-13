"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, Icon, NoticeBanner, PageHeader, Surface } from "@/components/system/primitives";
import { apiFetch, formatCurrency } from "@/lib/api";

const UNAVAILABLE_STATUSES = new Set(["sold", "hidden", "suspended", "draft"]);

function groupBySeller(items = []) {
  const map = new Map();
  for (const item of items) {
    const sellerKey = item.listing?.seller?.id || item.listing?.seller?.fullName || "seller";
    const sellerName = item.listing?.seller?.fullName || "Campus seller";
    const current = map.get(sellerKey) || { sellerName, total: 0, items: [] };
    current.total += (item.listing?.price || 0) * item.quantity;
    current.items.push(item);
    map.set(sellerKey, current);
  }
  return [...map.values()];
}

function getListingThumb(listing) {
  const media = listing?.mediaAssets?.find((item) => item.publicUrl)?.publicUrl;
  return media || listing?.imageUrls?.[0] || "";
}

function getCartListingId(entry) {
  return entry?.listing?.id || entry?.listingId || entry?.id;
}

function getCartItemState(entry) {
  const listing = entry?.listing;
  if (!listing) {
    return {
      unavailable: true,
      quantityInvalid: false,
      maxQty: 0,
      notice: "Item no longer exists in the marketplace. Remove it from your cart.",
    };
  }

  const inventory = Math.max(0, Number(listing.inventoryCount || 0));

  if (UNAVAILABLE_STATUSES.has(String(listing.status || "")) || inventory < 1) {
    return {
      unavailable: true,
      quantityInvalid: false,
      maxQty: inventory,
      notice: "Item is no longer available. Remove it from your cart.",
    };
  }

  if (entry.quantity > inventory) {
    return {
      unavailable: false,
      quantityInvalid: true,
      maxQty: inventory,
      notice: `Only ${inventory} ${inventory === 1 ? "unit is" : "units are"} available now. Reduce quantity or remove the item.`,
    };
  }

  return {
    unavailable: false,
    quantityInvalid: false,
    maxQty: inventory,
    notice: "",
  };
}

export function V2CartPage() {
  const { auth, signedInLike, cart, refreshCart } = useV2AppState();
  const [busy, setBusy] = useState("");
  const [checkoutSummary, setCheckoutSummary] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!signedInLike || cart?.items?.length) return;
    refreshCart().catch(() => setMessage("Could not load cart."));
  }, [signedInLike, cart?.items?.length]);

  useEffect(() => {
    if (!signedInLike || !cart?.items?.length || checkoutSummary || busy === "checkout") return;
    runCheckout().catch(() => null);
  }, [signedInLike, cart?.items?.length, checkoutSummary]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const grouped = useMemo(() => groupBySeller(cart?.items || []), [cart]);
  const hasBlockingCartIssue = useMemo(
    () =>
      (cart?.items || []).some((item) => {
        const state = getCartItemState(item);
        return state.unavailable || state.quantityInvalid;
      }),
    [cart],
  );

  async function removeItem(itemId) {
    setBusy(itemId);
    try {
      await apiFetch(`/cart/items/${itemId}`, auth, { method: "DELETE" });
      await refreshCart({ bypassCache: true });
    } catch {
      setMessage("Could not remove cart item.");
    } finally {
      setBusy("");
    }
  }

  async function updateQuantity(item, quantity) {
    if (quantity < 1 || quantity > (item.listing?.inventoryCount || 1)) return;
    setBusy(item.id);
    try {
      await apiFetch(`/cart/items/${item.id}`, auth, {
        method: "PATCH",
        body: { quantity },
      });
      await refreshCart({ bypassCache: true });
    } catch {
      setMessage("Could not update quantity.");
    } finally {
      setBusy("");
    }
  }

  async function clearCart() {
    setBusy("clear");
    try {
      await apiFetch("/cart", auth, { method: "DELETE" });
      setCheckoutSummary(null);
      await refreshCart({ bypassCache: true });
    } catch {
      setMessage("Could not clear cart.");
    } finally {
      setBusy("");
    }
  }

  async function runCheckout() {
    setBusy("checkout");
    try {
      const response = await apiFetch("/cart/checkout-simulate", auth, { method: "POST" });
      setCheckoutSummary(response.data || null);
      setMessage("Checkout simulation refreshed.");
      await refreshCart({ bypassCache: true });
    } catch {
      setMessage("Could not simulate checkout.");
    } finally {
      setBusy("");
    }
  }

  if (!signedInLike) {
    return (
      <div className="v2-cart-page">
        <PageHeader
          compact
          eyebrow="Cart"
          title="Sign in to keep your cart across sessions."
          description="The cart is backend-backed, with seller grouping and transaction context kept intact."
          actions={<Button href="/auth">Sign in</Button>}
        />
      </div>
    );
  }

  return (
    <div className="v2-cart-page">
      <PageHeader
        compact
        eyebrow="Cart"
        title="Review grouped checkout before you settle anything."
        description="Review your selected items, verify live availability, and remove anything that is no longer active."
        actions={
          <>
            <Button onClick={runCheckout} variant="secondary" disabled={busy === "checkout" || !cart?.items?.length || hasBlockingCartIssue}>
              {busy === "checkout" ? "Refreshing..." : "Run checkout"}
            </Button>
            <Button onClick={clearCart} variant="ghost" disabled={busy === "clear" || !cart?.items?.length}>
              Clear cart
            </Button>
          </>
        }
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}
      {hasBlockingCartIssue ? (
        <NoticeBanner
          tone="safety"
          title="Cart needs attention"
          description="One or more items are sold, missing, or over the current available quantity. Update or remove them before checkout."
        />
      ) : null}

      {!cart?.items?.length ? (
        <EmptyBlock title="Cart is empty" description="Add listings from browse, detail, or compare to build a grouped checkout view." />
      ) : (
        <div className="v2-marketplace-layout v2-cart-layout">
          <div className="v2-detail-main">
            {grouped.map((group) => (
              <Surface key={group.sellerName} title={group.sellerName} description={`${group.items.length} listing${group.items.length === 1 ? "" : "s"} / ${formatCurrency(group.total)}`}>
                <div className="v2-inline-list">
                  {group.items.map((entry) => {
                    const itemState = getCartItemState(entry);
                    const maxQty = Math.max(1, itemState.maxQty || entry.listing?.inventoryCount || 1);
                    const thumb = getListingThumb(entry.listing);
                    const listingId = getCartListingId(entry);
                    return (
                      <div key={entry.id} className={`v2-cart-row ${itemState.unavailable || itemState.quantityInvalid ? "v2-cart-row-stale" : ""}`}>
                        <Link href={`/listings/${listingId}`} className="v2-cart-thumb">
                          {thumb ? <img src={thumb} alt={entry.listing?.title || "Listing"} /> : <span>{entry.listing?.category || "Listing"}</span>}
                        </Link>
                        <div className="v2-cart-row-main">
                          <div>
                            <strong>{entry.listing?.title || "Listing"}</strong>
                            <span>{formatCurrency(entry.listing?.price || 0)} / {entry.listing?.area || "Campus"}</span>
                            <small className="v2-cart-item-meta">
                              {entry.listing?.status === "active" ? `${maxQty} available now` : `status: ${entry.listing?.status || "unavailable"}`}
                            </small>
                          </div>
                          <div className="v2-cart-qty">
                            <button type="button" className="v2-card-icon-button" onClick={() => updateQuantity(entry, entry.quantity - 1)} disabled={busy === entry.id || entry.quantity <= 1}>-</button>
                            <strong>{entry.quantity}</strong>
                            <button type="button" className="v2-card-icon-button" onClick={() => updateQuantity(entry, entry.quantity + 1)} disabled={busy === entry.id || itemState.unavailable || entry.quantity >= maxQty}>+</button>
                          </div>
                          {itemState.notice ? <p className="v2-cart-row-alert">{itemState.notice}</p> : null}
                        </div>
                        <div className="v2-inline-actions v2-cart-actions">
                          <Link href={`/listings/${listingId}`} className="v2-card-icon-button">Open</Link>
                          <button type="button" className="v2-card-icon-button" onClick={() => removeItem(entry.id)} disabled={busy === entry.id}>
                            <Icon name="trash" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Surface>
            ))}
          </div>

          <aside className="v2-detail-side">
            <Surface title="Settlement summary" description="Review totals by seller before you message, meet up, or settle payment.">
              <div className="v2-metric-grid">
                <div className="v2-fact-card"><span>Total items</span><strong>{cart.items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
                <div className="v2-fact-card"><span>Estimated total</span><strong>{formatCurrency(cart.totalAmount || 0)}</strong></div>
                <div className="v2-fact-card"><span>Seller groups</span><strong>{grouped.length}</strong></div>
              </div>
              <div className="v2-checklist">
                <span>Inspect items before payment.</span>
                <span>Ensure all coordination remains within the item's chat thread.</span>
                <span>Remove sold or unavailable items before attempting checkout.</span>
              </div>
              {checkoutSummary?.sellerSettlements?.length ? (
                <div className="v2-inline-list">
                  {checkoutSummary.sellerSettlements.map((item) => (
                    <div key={item.sellerProfileId || item.sellerName} className="v2-inline-row">
                      <div>
                        <strong>{item.sellerName}</strong>
                        <span>{item.itemCount} item{item.itemCount === 1 ? "" : "s"} / {formatCurrency(item.totalAmount || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock title="Checkout preview loading" description="Seller-by-seller totals will appear here after the cart is prepared." />
              )}
            </Surface>
          </aside>
        </div>
      )}
    </div>
  );
}
