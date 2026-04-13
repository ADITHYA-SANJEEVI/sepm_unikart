"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, prefetchApi } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const AppContext = createContext(null);

const DEFAULT_AUTH = {
  accessToken: "",
  user: null,
  profile: null,
  loading: true,
  overrideSecret: "",
  devEmail: "",
  devRole: "buyer",
  devFullName: "",
};

const DEFAULT_COMPARE = [];
const EMPTY_INBOX = {
  counts: {
    all: 0,
    unread: 0,
    buying: 0,
    selling: 0,
    safety: 0,
    system: 0,
    admin: 0,
  },
  all: { needsAction: [], recent: [], earlier: [] },
};
const EMPTY_CART = { items: [], totalAmount: 0, sellerBreakdown: [] };

function isInlineMediaUrl(value) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("data:");
}

function sanitizeCartListing(listing) {
  if (!listing || typeof listing !== "object") return null;

  const mediaThumb = Array.isArray(listing.mediaAssets)
    ? listing.mediaAssets.find((item) => item?.publicUrl && !isInlineMediaUrl(item.publicUrl))
    : null;
  const imageThumb = Array.isArray(listing.imageUrls)
    ? listing.imageUrls.find((url) => !isInlineMediaUrl(url))
    : "";
  const thumbUrl = mediaThumb?.publicUrl || imageThumb || "";

  return {
    id: listing.id || "",
    sellerProfileId: listing.sellerProfileId || "",
    title: listing.title || "Listing",
    price: Number(listing.price || 0),
    inventoryCount: Number(listing.inventoryCount || 0),
    currency: listing.currency || "INR",
    category: listing.category || "",
    condition: listing.condition || "",
    status: listing.status || "",
    mode: listing.mode || "sale",
    negotiable: Boolean(listing.negotiable),
    fulfillmentModes: Array.isArray(listing.fulfillmentModes) ? listing.fulfillmentModes : [],
    area: listing.area || "",
    campusId: listing.campusId || "",
    imageUrls: thumbUrl ? [thumbUrl] : [],
    mediaAssets: thumbUrl ? [{ publicUrl: thumbUrl, mediaKind: "image" }] : [],
    trustScore: Number(listing.trustScore || 0),
    updatedAt: listing.updatedAt || "",
    seller: listing.seller
      ? {
          id: listing.seller.id || "",
          fullName: listing.seller.fullName || "Campus seller",
          isVerified: Boolean(listing.seller.isVerified),
          sellerHeadline: listing.seller.sellerHeadline || "",
          responseReliability: listing.seller.responseReliability || "",
        }
      : null,
  };
}

function sanitizeCartForPersistence(value) {
  const normalized = normalizeCartState(value);
  return {
    totalAmount: normalized.totalAmount,
    sellerBreakdown: normalized.sellerBreakdown,
    items: normalized.items.map((item) => ({
      id: item.id || "",
      quantity: Number(item.quantity || 0),
      listingId: item.listingId || item.listing?.id || "",
      listing: sanitizeCartListing(item.listing),
    })),
  };
}

function normalizeCartState(value) {
  const base = value && typeof value === "object" ? value : EMPTY_CART;
  const items = Array.isArray(base.items)
    ? base.items.map((item) => ({
        ...item,
        quantity: Number(item?.quantity || 0),
        listing: sanitizeCartListing(item?.listing),
        listingId: item?.listingId || item?.listing?.id || "",
      }))
    : [];

  return {
    ...EMPTY_CART,
    ...base,
    items,
    totalAmount: Number(base.totalAmount || 0),
    sellerBreakdown: Array.isArray(base.sellerBreakdown) ? base.sellerBreakdown : [],
  };
}

function load(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function V2AppProviders({ children }) {
  const [auth, setAuth] = useState(DEFAULT_AUTH);
  const [health, setHealth] = useState({ loading: true, backend: false, authOff: null });
  const [notifications, setNotifications] = useState([]);
  const [notificationInbox, setNotificationInbox] = useState(EMPTY_INBOX);
  const [compareIds, setCompareIds] = useState(DEFAULT_COMPARE);
  const [compareOverlayOpen, setCompareOverlayOpen] = useState(false);
  const [cart, setCart] = useState(EMPTY_CART);
  const [savedProfileReady, setSavedProfileReady] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const authOffSession = health.authOff === true;
  const signedInLike = authOffSession || !!(auth.profile || auth.overrideSecret || auth.devEmail || auth.user || auth.accessToken);

  useEffect(() => {
    setAuth((current) => ({
      ...current,
      ...load("unikart-next-auth", {
        overrideSecret: "",
        devEmail: "",
        devRole: "buyer",
        devFullName: "",
      }),
    }));
    setCompareIds(load("unikart-next-compare", DEFAULT_COMPARE));
    setNotifications(load("unikart-next-notifications", []));
    setNotificationInbox(load("unikart-next-notification-inbox", EMPTY_INBOX));
    setCart(normalizeCartState(load("unikart-next-cart", EMPTY_CART)));
    setSavedProfileReady(true);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuth((current) => ({ ...current, loading: false }));
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setAuth((current) => ({
        ...current,
        accessToken: data.session?.access_token || "",
        user: data.session?.user || null,
        loading: false,
      }));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth((current) => ({
        ...current,
        accessToken: session?.access_token || "",
        user: session?.user || null,
        loading: false,
      }));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    apiFetch("/health", auth, { cacheMs: 5000 })
      .then((response) => {
        setHealth({
          loading: false,
          backend: true,
          authOff: response?.authOff ?? null,
        });
      })
      .catch(() => {
        setHealth({
          loading: false,
          backend: false,
          authOff: null,
        });
      });
  }, [auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!savedProfileReady) return;
    if (!authOffSession && !auth.overrideSecret && !auth.accessToken && !auth.devEmail) {
      setAuth((current) => ({ ...current, profile: null, loading: false }));
      return;
    }

    apiFetch("/auth/me", auth)
      .then((response) => {
        setAuth((current) => ({
          ...current,
          user: response.data?.user || current.user,
          profile: response.data?.profile || null,
          loading: false,
        }));
      })
      .catch(() => {
        setAuth((current) => ({ ...current, profile: null, loading: false }));
      });
  }, [savedProfileReady, authOffSession, auth.accessToken, auth.overrideSecret, auth.devEmail, auth.devRole, auth.devFullName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "unikart-next-auth",
      JSON.stringify({
        overrideSecret: auth.overrideSecret,
        devEmail: auth.devEmail,
        devRole: auth.devRole,
        devFullName: auth.devFullName,
      }),
    );
  }, [auth.overrideSecret, auth.devEmail, auth.devRole, auth.devFullName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("unikart-next-compare", JSON.stringify(compareIds));
  }, [compareIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("unikart-next-notifications", JSON.stringify(notifications));
    window.localStorage.setItem("unikart-next-notification-inbox", JSON.stringify(notificationInbox));
  }, [notifications, notificationInbox]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("unikart-next-cart", JSON.stringify(sanitizeCartForPersistence(cart)));
    } catch {
      window.localStorage.removeItem("unikart-next-cart");
    }
  }, [cart]);

  async function refreshNotifications(options = {}) {
    if (!signedInLike) {
      setNotifications([]);
      setNotificationInbox(EMPTY_INBOX);
      return;
    }

    const [listResponse, inboxResponse] = await Promise.all([
      apiFetch("/users/notifications", auth, {
        cacheMs: 15000,
        bypassCache: options.bypassCache === true,
      }).catch(() => ({ data: [] })),
      apiFetch("/users/notifications/inbox", auth, {
        cacheMs: 15000,
        bypassCache: options.bypassCache === true,
      }).catch(() => ({ data: EMPTY_INBOX })),
    ]);

    setNotifications(listResponse.data || []);
    setNotificationInbox(listResponse.data ? inboxResponse.data || EMPTY_INBOX : EMPTY_INBOX);
  }

  async function refreshCart(options = {}) {
    if (!signedInLike) {
      setCart(EMPTY_CART);
      return;
    }

    const response = await apiFetch("/cart", auth, {
      cacheMs: options.cacheMs ?? 15000,
      bypassCache: options.bypassCache === true,
    }).catch(() => ({ data: EMPTY_CART }));
    setCart(normalizeCartState(response.data || EMPTY_CART));
  }

  useEffect(() => {
    if (!savedProfileReady || auth.loading || health.loading) return;
    let cancelled = false;
    setAppReady(false);

    async function bootstrapWorkspace() {
      const tasks = [
        prefetchApi("/listings?limit=48&sort=newest", auth, { cacheMs: 120000, staleMs: 900000 }),
      ];

      if (signedInLike) {
        tasks.push(refreshNotifications());
        tasks.push(refreshCart());
        tasks.push(refreshCompareQueue({ preserveLocalOnEmpty: true }));
        tasks.push(prefetchApi("/chat", auth, { cacheMs: 120000, staleMs: 900000 }));
      }

      await Promise.allSettled(tasks);
      if (!cancelled) {
        setAppReady(true);
      }
    }

    bootstrapWorkspace().catch(() => {
      if (!cancelled) setAppReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [savedProfileReady, auth.loading, health.loading, signedInLike, auth.profile?.id, auth.overrideSecret, auth.devEmail, auth.accessToken]);

  useEffect(() => {
    if (!appReady || !signedInLike) return undefined;
    const interval = window.setInterval(() => {
      refreshNotifications({ bypassCache: true }).catch(() => null);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [appReady, signedInLike, auth.profile?.id, auth.overrideSecret, auth.devEmail, auth.accessToken]);

  async function refreshCompareQueue(options = {}) {
    const preserveLocalOnEmpty = options.preserveLocalOnEmpty !== false;
    if (!signedInLike) {
      setCompareIds([]);
      return [];
    }

    const localIds = load("unikart-next-compare", DEFAULT_COMPARE).filter(Boolean).slice(0, 3);
    const response = await apiFetch("/users/compare-queue", auth).catch(() => ({ data: [] }));
    const nextIds = (response.data || [])
      .map((item) => item.listingId)
      .filter(Boolean)
      .slice(0, 3);

    if (nextIds.length) {
      setCompareIds(nextIds);
      return nextIds;
    }

    if (preserveLocalOnEmpty && localIds.length) {
      setCompareIds(localIds);
      return localIds;
    }

    setCompareIds([]);
    return [];
  }

  function setDevPersona(persona) {
    setAuth((current) => ({
      ...current,
      devEmail: persona?.email?.trim().toLowerCase() || "",
      devRole: persona?.role || "buyer",
      devFullName: persona?.fullName || "",
    }));
  }

  function syncCompareQueue(nextIds) {
    const limitedIds = nextIds.filter(Boolean).slice(0, 3);
    setCompareIds(limitedIds);

    if (!signedInLike) return;

    apiFetch("/users/compare-queue", auth, {
      method: "PUT",
      body: { listingIds: limitedIds },
    })
      .then((response) => {
        const confirmedIds = (response.data || [])
          .map((item) => item.listingId)
          .filter(Boolean)
          .slice(0, 3);
        if (confirmedIds.length || !limitedIds.length) {
          setCompareIds(confirmedIds);
        }
      })
      .catch(() => null);
  }

  function toggleCompareListing(listingId) {
    setCompareIds((current) => {
      const currentlyActive = current.includes(listingId);
      const next = currentlyActive
        ? current.filter((id) => id !== listingId)
        : current.length >= 3
          ? [...current.slice(1), listingId]
          : [...current, listingId];

      if (signedInLike) {
        const request = currentlyActive
          ? apiFetch(`/users/compare-queue/${listingId}`, auth, { method: "DELETE" })
          : apiFetch(`/users/compare-queue/${listingId}`, auth, { method: "POST" });

        request.catch(() => null);
      }

      return next;
    });
  }

  function clearCompareQueue() {
    setCompareIds([]);
    setCompareOverlayOpen(false);
    if (!signedInLike) return;
    apiFetch("/users/compare-queue", auth, { method: "DELETE" })
      .then(() => refreshCompareQueue())
      .catch(() => null);
  }

  function openCompareOverlay() {
    setCompareOverlayOpen(true);
  }

  function closeCompareOverlay() {
    setCompareOverlayOpen(false);
  }

  async function signInWithMagicLink(email) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return { success: false, message: "Supabase auth is not configured in this browser." };
    }
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return { success: false, message: "Enter a valid email address." };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return { success: false, message: error.message || "Could not send magic link." };
    }

    return { success: true, message: `Magic link sent to ${normalized}.` };
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore sign-out failures and still clear local workspace auth
      }
    }

    setAuth({
      ...DEFAULT_AUTH,
      loading: false,
    });
    setNotifications([]);
    setNotificationInbox(EMPTY_INBOX);
    setCart(EMPTY_CART);
  }

  const cartCount = (cart?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const value = useMemo(
    () => ({
      auth,
      setAuth,
      health,
      appReady,
      signedInLike,
      notifications,
      notificationInbox,
      refreshNotifications,
      compareIds,
      setCompareIds,
      compareOverlayOpen,
      openCompareOverlay,
      closeCompareOverlay,
      refreshCompareQueue,
      syncCompareQueue,
      toggleCompareListing,
      clearCompareQueue,
      cart,
      cartCount,
      refreshCart,
      signInWithMagicLink,
      setDevPersona,
      signOut,
    }),
    [auth, health, appReady, signedInLike, notifications, notificationInbox, compareIds, compareOverlayOpen, cart, cartCount],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useV2AppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useV2AppState must be used within V2AppProviders");
  }
  return context;
}
