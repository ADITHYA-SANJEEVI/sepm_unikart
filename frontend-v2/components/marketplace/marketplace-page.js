"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, Icon, MetricTile, NoticeBanner, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { V2ListingCard } from "@/components/marketplace/v2-listing-card";
import { SelectField } from "@/components/system/select-field";
import { apiFetch, formatCurrency, loadCompareListings, peekApiCache, prefetchApi } from "@/lib/api";
import { getNextCompareQueue } from "@/lib/compare";

const defaultFilters = {
  search: "",
  category: "",
  condition: "",
  mode: "",
  minPrice: "",
  maxPrice: "",
  sort: "newest",
  negotiableOnly: false,
  deliveryOnly: false,
};

const categoryOptions = [
  { value: "", label: "All" },
  { value: "books", label: "Books" },
  { value: "electronics", label: "Electronics" },
  { value: "cycle", label: "Cycles" },
  { value: "furniture", label: "Furniture" },
  { value: "fashion", label: "Fashion" },
  { value: "hostel-essentials", label: "Essentials" },
  { value: "appliances", label: "Appliances" },
];

const discoveryBuckets = [
  { title: "Exam season picks", description: "Calculators, lamps, and desk gear that usually move quickly near campus deadlines.", category: "electronics" },
  { title: "Room reset", description: "Kettles, fans, organizers, and hostel essentials with a faster decision cycle.", category: "hostel-essentials" },
  { title: "Ride and go", description: "Cycles and mobility listings that often need trust, condition, and meetup clarity up front.", category: "cycle" },
];

function buildListingsPath(filters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.mode) params.set("mode", filters.mode);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.negotiableOnly) params.set("negotiableOnly", "true");
  if (filters.deliveryOnly) params.set("deliveryAvailable", "true");
  if (filters.sort) params.set("sort", filters.sort);
  params.set("limit", "48");
  return `/listings?${params.toString()}`;
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.search.trim() ||
      filters.category ||
      filters.condition ||
      filters.mode ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.negotiableOnly ||
      filters.deliveryOnly,
  );
}

function countActiveFilters(filters) {
  return [
    filters.search.trim(),
    filters.category,
    filters.condition,
    filters.mode,
    filters.minPrice,
    filters.maxPrice,
    filters.negotiableOnly,
    filters.deliveryOnly,
  ].filter(Boolean).length;
}

function summarizeFilter(filterPayload = {}) {
  const parts = [];
  if (filterPayload.search) parts.push(`"${filterPayload.search}"`);
  if (filterPayload.category) parts.push(String(filterPayload.category));
  if (filterPayload.condition) parts.push(String(filterPayload.condition).replaceAll("_", " "));
  if (filterPayload.mode) parts.push(String(filterPayload.mode));
  if (filterPayload.maxPrice) parts.push(`under INR ${filterPayload.maxPrice}`);
  if (filterPayload.negotiableOnly) parts.push("negotiable");
  if (filterPayload.deliveryOnly || filterPayload.deliveryAvailable) parts.push("campus drop");
  return parts.length ? parts.join(" / ") : "All campus listings";
}

export function MarketplacePage() {
  const { auth, signedInLike, compareIds, toggleCompareListing, clearCompareQueue, openCompareOverlay, refreshCart, cart, cartCount } = useV2AppState();
  const [filters, setFilters] = useState(defaultFilters);
  const [listings, setListings] = useState([]);
  const [compareListings, setCompareListings] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favoriteBusyId, setFavoriteBusyId] = useState("");
  const [cartBusyId, setCartBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      search: deferredSearch,
    }),
    [
      deferredSearch,
      filters.category,
      filters.condition,
      filters.deliveryOnly,
      filters.maxPrice,
      filters.minPrice,
      filters.mode,
      filters.negotiableOnly,
      filters.sort,
    ],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setFilters((current) => ({
      ...current,
      search: params.get("search") || params.get("q") || "",
      category: params.get("category") || "",
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const listingsPath = buildListingsPath(effectiveFilters);
    const listingsCacheOptions = { cacheMs: 120000, staleMs: 900000 };
    const cached = peekApiCache(listingsPath, auth, listingsCacheOptions);
    if (cached?.data?.length) {
      setListings(cached.data || []);
      setLoading(false);
    } else {
      setLoading(true);
    }

    prefetchApi(listingsPath, auth, listingsCacheOptions).catch(() => null);

    apiFetch(listingsPath, auth, listingsCacheOptions)
      .then((response) => {
        if (!cancelled) setListings(response.data || []);
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, auth.overrideSecret, auth.devEmail, effectiveFilters]);

  useEffect(() => {
    if (!signedInLike) {
      setSavedFilters([]);
      return;
    }
    apiFetch("/users/saved-filters", auth, { cacheMs: 60000 })
      .then((response) => setSavedFilters(response.data || []))
      .catch(() => setSavedFilters([]));
  }, [signedInLike, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!compareIds.length) {
      setCompareListings([]);
      return;
    }
    loadCompareListings(compareIds, auth, { cacheMs: 60000 })
      .then((items) => setCompareListings(items))
      .catch(() => setCompareListings([]));
  }, [compareIds, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!listings.length) return;
    const detailCacheOptions = { cacheMs: 600000, staleMs: 21600000 };
    for (const listing of listings.slice(0, 4)) {
      prefetchApi(`/listings/${listing.id}`, auth, detailCacheOptions).catch(() => null);
    }
  }, [listings, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  const resultsMode = hasActiveFilters(filters);
  const activeFilterCount = countActiveFilters(filters);
  const marketplacePulse = useMemo(
    () => [
      { label: "Freshest lane", value: effectiveFilters.search.trim() ? "Search focus" : "Campus pulse", detail: effectiveFilters.search.trim() ? "fetch follows your deferred search" : "browse without hammering Supabase" },
      { label: "Search mode", value: activeFilterCount ? `${activeFilterCount} filters` : "Open", detail: activeFilterCount ? summarizeFilter(filters) : "all live categories visible" },
      { label: "Next step", value: compareIds.length ? "Compare ready" : "Build shortlist", detail: compareIds.length ? "overlay can open immediately" : "save or compare from any card" },
    ],
    [activeFilterCount, compareIds.length, effectiveFilters.search, filters],
  );
  const metrics = useMemo(
    () => [
      { label: "Listings", value: String(listings.length), detail: resultsMode ? "matching the current search state" : "ready to browse", tone: "selling" },
      { label: "Saved searches", value: String(savedFilters.length), detail: signedInLike ? "editable alert sets" : "sign in to save them", tone: "buying" },
      { label: "Shortlist", value: String(compareIds.length), detail: compareIds.length ? "visible from header and compare" : "compare up to three", tone: "neutral" },
    ],
    [listings.length, resultsMode, savedFilters.length, signedInLike, compareIds.length],
  );

  const cartQuantities = useMemo(() => {
    const next = new Map();
    for (const item of cart?.items || []) {
      const listingId = item?.listing?.id || item?.listingId;
      if (!listingId) continue;
      next.set(listingId, Number(item.quantity || 0));
    }
    return next;
  }, [cart]);

  const searchSuggestions = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    if (!needle) return [];
    return categoryOptions
      .filter((option) => option.value && option.label.toLowerCase().includes(needle))
      .slice(0, 4);
  }, [filters.search]);

  async function handleToggleFavorite(listing) {
    if (!signedInLike) {
      setMessage("Sign in to save listings.");
      return;
    }

    setFavoriteBusyId(listing.id);
    const nextFavorited = !listing.isFavorited;
    setListings((current) =>
      current.map((item) => (item.id === listing.id ? { ...item, isFavorited: nextFavorited } : item)),
    );

    try {
      await apiFetch(`/listings/${listing.id}/favorite`, auth, {
        method: listing.isFavorited ? "DELETE" : "POST",
      });
      setMessage(nextFavorited ? "Saved to your shortlist." : "Removed from saved.");
    } catch {
      setListings((current) =>
        current.map((item) => (item.id === listing.id ? { ...item, isFavorited: listing.isFavorited } : item)),
      );
      setMessage("Could not update saved state.");
    } finally {
      setFavoriteBusyId("");
    }
  }

  async function handleAddToCart(listing) {
    if (!signedInLike) {
      setMessage("Sign in to add items to cart.");
      return;
    }

    setCartBusyId(listing.id);
    try {
      await apiFetch("/cart/items", auth, {
        method: "POST",
        body: { listingId: listing.id, quantity: 1 },
      });
      await refreshCart({ bypassCache: true });
      setMessage("Added to cart. Open cart from the header any time.");
    } catch (error) {
      setMessage(error.message || "Could not add this listing to cart.");
    } finally {
      setCartBusyId("");
    }
  }

  async function handleSaveCurrentFilter() {
    if (!signedInLike) {
      setMessage("Sign in to save search alerts.");
      return;
    }

    const label = filters.search.trim() || filters.category || filters.mode || `Campus search ${savedFilters.length + 1}`;
    try {
      const response = await apiFetch("/users/saved-filters", auth, {
        method: "POST",
        body: {
          label,
          filterPayload: filters,
          alertEnabled: true,
        },
      });
      setSavedFilters((current) => [response.data, ...current]);
      setMessage(`Saved "${label}". Manage it from the sidebar or profile.`);
    } catch {
      setMessage("Could not save this search.");
    }
  }

  async function handleToggleFilterAlert(filterId, enabled) {
    try {
      const response = await apiFetch(`/users/saved-filters/${filterId}`, auth, {
        method: "PATCH",
        body: { alertEnabled: !enabled },
      });
      setSavedFilters((current) => current.map((item) => (item.id === filterId ? response.data : item)));
    } catch {
      setMessage("Could not update alert state.");
    }
  }

  async function handleRenameSavedFilter(filter) {
    const nextLabel = window.prompt("Rename saved search", filter.label || "");
    if (!nextLabel || nextLabel === filter.label) return;
    try {
      const response = await apiFetch(`/users/saved-filters/${filter.id}`, auth, {
        method: "PATCH",
        body: {
          label: nextLabel.trim(),
          filterPayload: filter.filterPayload,
          alertEnabled: filter.alertEnabled,
        },
      });
      setSavedFilters((current) => current.map((item) => (item.id === filter.id ? response.data : item)));
      setMessage("Saved search updated.");
    } catch {
      setMessage("Could not rename this saved search.");
    }
  }

  async function handleDeleteSavedFilter(filterId) {
    try {
      await apiFetch(`/users/saved-filters/${filterId}`, auth, { method: "DELETE" });
      setSavedFilters((current) => current.filter((item) => item.id !== filterId));
    } catch {
      setMessage("Could not remove this saved search.");
    }
  }

  async function handleClearSavedFilters() {
    try {
      await apiFetch("/users/saved-filters", auth, { method: "DELETE" });
      setSavedFilters([]);
      setMessage("Cleared saved searches.");
    } catch {
      setMessage("Could not clear saved searches.");
    }
  }

  function handleToggleCompare(listing) {
    const nextActive = !compareIds.includes(listing.id);
    const nextQueue = getNextCompareQueue(compareIds, listing.id);
    toggleCompareListing(listing.id);
    if (nextActive && nextQueue.length >= 2) {
      openCompareOverlay();
      setMessage("Compare ready. Review the overlay snapshot.");
      return;
    }
    setMessage(nextActive ? "Added to compare." : "Removed from compare.");
  }

  function resetFilters() {
    setFilters(defaultFilters);
    searchRef.current?.focus();
  }

  function applySavedFilter(filter) {
    setFilters((current) => ({ ...current, ...filter.filterPayload }));
    setMessage(`Applied "${filter.label}".`);
  }

  return (
    <div className="v2-marketplace-page">
      <PageHeader
        compact
        eyebrow="Marketplace"
        title="Campus listings, without the clutter."
        description="Search, shortlist, and move through listings with a faster browse flow and a stronger visual rhythm."
        actions={
          <>
            <Button href="/favorites" variant="secondary">Saved</Button>
            <Button href="/sell">Create Listing</Button>
          </>
        }
      />

      <section className="v2-marketplace-atlas">
        <div className="v2-marketplace-atlas-copy">
          <span className="v2-eyebrow">Campus Pulse</span>
          <h2>{deferredSearch.trim() ? `Scanning for ${deferredSearch.trim()}` : "Discovery lanes tuned for fast campus browsing."}</h2>
          <p>
            Search input now defers the expensive listing refresh path, while the discovery rail keeps quick category pivots visible instead of dropping you into a flat wall of cards.
          </p>
        </div>
        <div className="v2-marketplace-atlas-grid">
          {marketplacePulse.map((item) => (
            <article key={item.label} className="v2-marketplace-atlas-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="v2-marketplace-search-shell">
        <div className="v2-marketplace-search-main">
          <div className="v2-marketplace-search-bar">
            <Icon name="search" />
            <input
              ref={searchRef}
              value={filters.search}
              placeholder="Search for calculators, cycles, lamps, kettles..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
            {activeFilterCount ? <StatusPill tone="buying">{activeFilterCount} active</StatusPill> : null}
          </div>

          {(searchFocused || filters.search.trim()) && (searchSuggestions.length || savedFilters.length) ? (
            <div className="v2-search-suggestions">
              {searchSuggestions.length ? (
                <div className="v2-search-suggestion-group">
                  <span>Categories</span>
                  {searchSuggestions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="v2-search-suggestion"
                      onMouseDown={() => setFilters((current) => ({ ...current, category: option.value }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {savedFilters.length ? (
                <div className="v2-search-suggestion-group">
                  <span>Saved searches</span>
                  {savedFilters.slice(0, 3).map((filter) => (
                    <button key={filter.id} type="button" className="v2-search-suggestion" onMouseDown={() => applySavedFilter(filter)}>
                      {filter.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="v2-marketplace-search-actions">
          <MetricTile label="Cart" value={String(cartCount)} detail="Always visible in the header" tone="neutral" href="/cart" />
          <MetricTile label="Compare" value={String(compareIds.length)} detail="Shortlist up to three listings" tone="buying" href="/compare" />
          <MetricTile label="Saved" value={String(savedFilters.length)} detail="Editable search alerts" tone="selling" href="/favorites" />
        </div>
      </section>

      {message ? <NoticeBanner tone="buying" title="Marketplace update" description={message} /> : null}

      {!resultsMode ? (
        <div className="v2-marketplace-discovery">
          <Surface
            title="Browse by intent"
            description="Start with a clean bucket, then narrow quickly once you know what you want."
          >
            <div className="v2-discovery-grid">
              {discoveryBuckets.map((bucket) => (
                <button
                  key={bucket.title}
                  type="button"
                  className="v2-discovery-card"
                  onClick={() => setFilters((current) => ({ ...current, category: bucket.category }))}
                >
                  <strong>{bucket.title}</strong>
                  <span>{bucket.description}</span>
                </button>
              ))}
            </div>
          </Surface>

          <section className="v2-marketplace-hero-strip">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} {...metric} />
            ))}
          </section>

          <Surface
            title="Saved searches"
            description="Save your frequent search filters."
            actions={savedFilters.length ? <Button variant="ghost" onClick={handleClearSavedFilters}>Clear all</Button> : null}
          >
            {savedFilters.length ? (
              <div className="v2-saved-filter-list">
                {savedFilters.slice(0, 6).map((item) => (
                  <article key={item.id} className="v2-saved-filter-card">
                    <button type="button" className="v2-saved-filter-main" onClick={() => applySavedFilter(item)}>
                      <strong>{item.label}</strong>
                      <span>{summarizeFilter(item.filterPayload)}</span>
                    </button>
                    <div className="v2-saved-filter-actions">
                      <button type="button" onClick={() => handleRenameSavedFilter(item)}>Edit</button>
                      <button type="button" onClick={() => handleToggleFilterAlert(item.id, item.alertEnabled)}>
                        {item.alertEnabled ? "Alerts on" : "Alerts off"}
                      </button>
                      <button type="button" onClick={() => handleDeleteSavedFilter(item.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock title="No saved searches yet" description="Save a strong filter set and it will stay here with edit and alert controls." />
            )}
          </Surface>
        </div>
      ) : null}

      {compareIds.length ? (
        <Surface
          title={`Compare queue (${compareIds.length}/3)`}
          description="Review your shortlist before comparing."
          actions={
            <>
              <Button variant="secondary" onClick={openCompareOverlay}>Quick compare</Button>
              <Button variant="ghost" onClick={clearCompareQueue}>Clear</Button>
            </>
          }
        >
          <div className="v2-utility-grid">
            {compareListings.map((listing) => (
              <Link key={listing.id} href={`/listings/${listing.id}`} className="v2-tool-link">
                <strong>{listing.title}</strong>
                <span>{formatCurrency(listing.price)} / {listing.area || "Campus"}</span>
              </Link>
            ))}
          </div>
        </Surface>
      ) : null}

      <div className="v2-marketplace-layout">
        <aside className={`v2-marketplace-sidebar ${resultsMode ? "v2-marketplace-sidebar-open" : ""}`}>
          <Surface
            title="Filters"
            description="Use category, condition, price, and mode filters without losing your place in results."
            className="v2-filter-surface"
            actions={
              <div className="v2-inline-actions">
                <Button onClick={handleSaveCurrentFilter}>Save search</Button>
                <Button variant="secondary" onClick={resetFilters}>Reset</Button>
              </div>
            }
          >
            <div className="v2-panel-scroll v2-field-stack">
              <label className="v2-field">
                <span>Category</span>
                <SelectField
                  value={filters.category}
                  onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
                  options={categoryOptions}
                />
              </label>

              <div className="v2-field-grid">
                <label className="v2-field">
                  <span>Condition</span>
                  <SelectField
                    value={filters.condition}
                    onChange={(value) => setFilters((current) => ({ ...current, condition: value }))}
                    options={[
                      { value: "", label: "All conditions" },
                      { value: "like_new", label: "Like new" },
                      { value: "good", label: "Good" },
                      { value: "fair", label: "Fair" },
                    ]}
                  />
                </label>

                <label className="v2-field">
                  <span>Mode</span>
                  <SelectField
                    value={filters.mode}
                    onChange={(value) => setFilters((current) => ({ ...current, mode: value }))}
                    options={[
                      { value: "", label: "All modes" },
                      { value: "sale", label: "Buy" },
                      { value: "rent", label: "Rent" },
                      { value: "bundle", label: "Bundle" },
                    ]}
                  />
                </label>
              </div>

              <div className="v2-field-grid">
                <label className="v2-field">
                  <span>Min price</span>
                  <input type="number" min="0" value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))} />
                </label>
                <label className="v2-field">
                  <span>Max price</span>
                  <input type="number" min="0" value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} />
                </label>
              </div>

              <label className="v2-field">
                <span>Sort</span>
                <SelectField
                  value={filters.sort}
                  onChange={(value) => setFilters((current) => ({ ...current, sort: value }))}
                  options={[
                    { value: "newest", label: "Newest first" },
                    { value: "price_asc", label: "Price low to high" },
                    { value: "price_desc", label: "Price high to low" },
                    { value: "trust_desc", label: "Highest trust" },
                  ]}
                />
              </label>

              <div className="v2-check-row">
                <label><input type="checkbox" checked={filters.negotiableOnly} onChange={(event) => setFilters((current) => ({ ...current, negotiableOnly: event.target.checked }))} /> Negotiable only</label>
                <label><input type="checkbox" checked={filters.deliveryOnly} onChange={(event) => setFilters((current) => ({ ...current, deliveryOnly: event.target.checked }))} /> Campus drop</label>
              </div>
            </div>
          </Surface>
        </aside>

        <section className="v2-marketplace-results">
          <Surface
            title={loading ? "Loading listings" : `${listings.length} listings`}
            description={resultsMode ? "Filters, result count, and direct actions stay together while you search." : "Browse a cleaner set of listing cards with direct decision actions."}
            actions={resultsMode ? <StatusPill tone="buying">{activeFilterCount} active filters</StatusPill> : null}
          >
            {loading ? (
              <EmptyBlock title="Loading browse results" description="Pulling listing details and current filter matches from the backend." />
            ) : listings.length ? (
              <div className="v2-card-grid">
                {listings.map((listing) => (
                  <V2ListingCard
                    key={listing.id}
                    listing={listing}
                    compareActive={compareIds.includes(listing.id)}
                    onToggleCompare={() => handleToggleCompare(listing)}
                    onToggleFavorite={handleToggleFavorite}
                    onAddToCart={() => handleAddToCart(listing)}
                    cartQuantity={cartQuantities.get(listing.id) || 0}
                    favoriteBusy={favoriteBusyId === listing.id}
                    cartBusy={cartBusyId === listing.id}
                  />
                ))}
              </div>
            ) : (
              <EmptyBlock title="No listings match these filters" description="Widen the price band, switch category, or clear a constraint to reopen the shortlist." />
            )}
          </Surface>
        </section>
      </div>
    </div>
  );
}
