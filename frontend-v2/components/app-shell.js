"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAppState } from "@/components/app-providers";

const marketingNav = [
  { href: "/marketplace", label: "Browse" },
  { href: "/policy", label: "Safety" },
  { href: "/support", label: "Support" },
];

const appNav = [
  { href: "/dashboard", label: "Dashboard", matches: ["/dashboard"] },
  { href: "/marketplace", label: "Browse", matches: ["/marketplace", "/listings"] },
  { href: "/messages", label: "Messages", matches: ["/messages", "/schedules"] },
  { href: "/support", label: "Support", matches: ["/support"] },
  { href: "/policy", label: "Safety", matches: ["/policy"] },
];

function getInitial(name) {
  return String(name || "U").trim().charAt(0).toUpperCase() || "U";
}

function getNotificationHref(item) {
  if (item.actionHref) return item.actionHref;
  if (item.entityType === "listing" && item.entityId) return `/listings/${item.entityId}`;
  if (item.entityType === "conversation" && item.entityId) return "/messages";
  if (item.entityType === "schedule" && item.entityId) return "/schedules";
  return "/dashboard";
}

function isActivePath(pathname, item) {
  const matches = item.matches || [item.href];
  return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
}

function summarizeRole(auth, isAdmin) {
  if (isAdmin) {
    return {
      label: "Admin workspace",
      hint: auth.overrideSecret ? "Override session" : "Moderation enabled",
    };
  }
  if (auth.profile?.role === "seller" || auth.devRole === "seller") {
    return {
      label: "Seller workspace",
      hint: auth.profile?.isVerified ? "Verified campus seller" : "Listing and response control",
    };
  }
  return {
    label: "Buyer workspace",
    hint: "Saved items, matches, and coordination",
  };
}

function bucketNotificationCounts(items) {
  return items.reduce(
    (accumulator, item) => {
      const key = item.category || "system";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    },
    { buying: 0, selling: 0, safety: 0, system: 0, admin: 0 },
  );
}

function formatCount(value) {
  if (!value) return "0";
  return value > 9 ? "9+" : String(value);
}

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    auth,
    session,
    cart,
    compareIds,
    dataVersion,
    signOut,
    setDevPersona,
  } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [personas, setPersonas] = useState([]);
  const menuRef = useRef(null);
  const isMarketingHome = pathname === "/";
  const signedInLike = !!(auth.profile || auth.overrideSecret || auth.devEmail || auth.user);
  const isAdmin = !!auth.overrideSecret || auth.profile?.role === "admin";
  const roleMeta = summarizeRole(auth, isAdmin);
  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const accountLabel = useMemo(() => {
    if (auth.profile?.fullName) return auth.profile.fullName;
    if (auth.devFullName) return auth.devFullName;
    if (auth.devEmail) return auth.devEmail.split("@")[0];
    if (auth.user?.email) return auth.user.email.split("@")[0];
    if (auth.overrideSecret) return "Override";
    if (auth.loading) return "Syncing";
    return "Guest";
  }, [auth]);

  const navItems = useMemo(
    () =>
      isMarketingHome
        ? marketingNav
        : [...appNav, ...(isAdmin ? [{ href: "/moderation", label: "Moderation", matches: ["/moderation"] }] : [])],
    [isAdmin, isMarketingHome],
  );

  const personalLinks = useMemo(() => {
    const profileHref = auth.profile ? `/profiles/${auth.profile.id}` : "/auth";
    return [
      { href: profileHref, label: "My Profile" },
      { href: `${profileHref}#my-listings`, label: "My Listings" },
      { href: "/favorites", label: "Saved Listings" },
      { href: "/notifications", label: `Notifications${notifications.some((item) => !item.readAt) ? ` (${notifications.filter((item) => !item.readAt).length})` : ""}` },
      { href: "/messages", label: "Messages" },
      { href: "/schedules", label: "Meetups" },
      { href: "/compare", label: `Compare Queue${compareIds.length ? ` (${compareIds.length})` : ""}` },
    ];
  }, [auth.profile, compareIds.length, notifications]);

  useEffect(() => {
    setMenuOpen(false);
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileNavOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const original = document.body.style.overflow;
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!signedInLike) {
      setNotifications([]);
      return;
    }
    apiFetch("/users/notifications", session)
      .then((response) => setNotifications(response.data || []))
      .catch(() => setNotifications([]));
  }, [signedInLike, session, dataVersion.notifications, dataVersion.dashboard, auth.profile?.id, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    fetch("/api/backend/auth/debug-bypass-status")
      .then((response) => response.json())
      .then((payload) => setPersonas(payload?.data?.testPersonas || []))
      .catch(() => setPersonas([]));
  }, []);

  const unreadNotificationCount = notifications.filter((item) => !item.readAt).length;
  const laneCounts = useMemo(() => bucketNotificationCounts(notifications), [notifications]);
  const workspaceChips = useMemo(
    () => [
      { href: "/notifications", label: "Unread", value: unreadNotificationCount, tone: "selling" },
      { href: "/compare", label: "Compare", value: compareIds.length, tone: "buying" },
      { href: "/cart", label: "Cart", value: cartCount, tone: "system" },
    ],
    [cartCount, compareIds.length, unreadNotificationCount],
  );

  async function markAllNotificationsRead() {
    setNotificationsBusy(true);
    try {
      await apiFetch("/users/notifications/read-all", session, {
        method: "PATCH",
      });
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function dismissNotification(itemId) {
    setNotificationsBusy(true);
    try {
      await apiFetch(`/users/notifications/${itemId}`, session, {
        method: "DELETE",
      });
      setNotifications((current) => current.filter((item) => item.id !== itemId));
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function openNotification(item) {
    if (!item.readAt) {
      setNotificationsBusy(true);
      try {
        await apiFetch(`/users/notifications/${item.id}/read`, session, {
          method: "PATCH",
        });
        setNotifications((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, readAt: entry.readAt || new Date().toISOString() } : entry,
          ),
        );
      } finally {
        setNotificationsBusy(false);
      }
    }
    setMenuOpen(false);
    setMobileNavOpen(false);
    router.push(getNotificationHref(item));
  }

  async function handleSignOut() {
    setMenuOpen(false);
    setMobileNavOpen(false);
    await signOut();
  }

  const drawerUtilities = [
    ...personalLinks,
    ...(isAdmin ? [{ href: "/moderation", label: "Moderation" }] : []),
  ];

  return (
    <div className={`site-shell ${mobileNavOpen ? "site-shell-overlay-open" : ""}`}>
      <header className={`site-header ${isMarketingHome ? "site-header-marketing" : "site-header-app"}`}>
        <div className="header-inner">
          <div className="header-leading">
            {!isMarketingHome ? (
              <button
                type="button"
                className="shell-mobile-toggle"
                aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((current) => !current)}
              >
                <span />
                <span />
                <span />
              </button>
            ) : null}
            <Link href="/" className="brand-lockup">
              <span className="brand-mark" />
              <span className="brand-wordmark">UniKart</span>
            </Link>
            {!isMarketingHome && signedInLike ? (
              <div className={`header-context-pill header-context-pill-${isAdmin ? "admin" : auth.profile?.role || auth.devRole || "buyer"}`}>
                <strong>{roleMeta.label}</strong>
                <span>{roleMeta.hint}</span>
              </div>
            ) : null}
          </div>

          <div className="header-actions">
            {isMarketingHome ? (
              <>
                <nav className="site-nav site-nav-inline" aria-label="Marketing navigation">
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href} className="site-nav-link">
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <Link href="/marketplace" className="secondary-button">
                  Browse Marketplace
                </Link>
                <Link href="/auth" className="sell-button">
                  Login
                </Link>
              </>
            ) : (
              <>
                <div className="header-utility-cluster">
                  <Link href="/notifications" className="header-utility-pill">
                    <span>Alerts</span>
                    <strong>{formatCount(unreadNotificationCount)}</strong>
                  </Link>
                  <Link href="/compare" className="header-utility-pill">
                    <span>Compare</span>
                    <strong>{formatCount(compareIds.length)}</strong>
                  </Link>
                  <Link href="/cart" className="header-utility-pill">
                    <span>Cart</span>
                    <strong>{formatCount(cartCount)}</strong>
                  </Link>
                </div>

                <Link href="/sell" className="sell-button header-primary-cta">
                  Sell an Item
                </Link>

                <div className="account-menu" ref={menuRef}>
                  <button
                    type="button"
                    className="account-pill"
                    aria-label="Open account"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((current) => !current)}
                  >
                    {unreadNotificationCount ? <span className="account-pill-badge">{formatCount(unreadNotificationCount)}</span> : null}
                    {getInitial(accountLabel)}
                  </button>

                  {menuOpen ? (
                    <div className="account-dropdown">
                      <div className="account-dropdown-head">
                        <div className="account-dropdown-avatar">{getInitial(accountLabel)}</div>
                        <div>
                          <strong>{auth.profile?.fullName || auth.user?.email || auth.devEmail || "Guest"}</strong>
                          <p className="panel-description">{roleMeta.label}</p>
                          <p className="panel-description">
                            {auth.profile?.sellerHeadline ||
                              auth.profile?.bio ||
                              (auth.overrideSecret ? "Admin override session" : "Campus account")}
                          </p>
                        </div>
                      </div>

                      <div className="account-dropdown-section">
                        <span className="account-dropdown-label">Workspace Status</span>
                        <div className="account-lane-summary">
                          <Link href="/notifications" className="account-lane-chip account-lane-chip-selling" onClick={() => setMenuOpen(false)}>
                            <span>Unread</span>
                            <strong>{unreadNotificationCount}</strong>
                          </Link>
                          <Link href="/compare" className="account-lane-chip account-lane-chip-buying" onClick={() => setMenuOpen(false)}>
                            <span>Compare</span>
                            <strong>{compareIds.length}</strong>
                          </Link>
                          <Link href="/cart" className="account-lane-chip account-lane-chip-system" onClick={() => setMenuOpen(false)}>
                            <span>Cart</span>
                            <strong>{cartCount}</strong>
                          </Link>
                        </div>
                        <div className="account-lane-summary">
                          {Object.entries(laneCounts).map(([lane, count]) => (
                            <span key={lane} className={`notification-mini-pill notification-mini-pill-${lane}`}>
                              {lane} {count}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="account-dropdown-section">
                        <span className="account-dropdown-label">Personal Hub</span>
                        <div className="account-dropdown-links">
                          {personalLinks.map((item) => (
                            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {personas.length ? (
                        <div className="account-dropdown-section">
                          <span className="account-dropdown-label">Testing Personas</span>
                          <div className="account-dropdown-links">
                            {personas.map((persona) => (
                              <button
                                key={persona.key}
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  setDevPersona(persona);
                                  setMenuOpen(false);
                                  router.refresh();
                                }}
                              >
                                {persona.fullName} ({persona.role})
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="account-dropdown-section">
                        <div className="account-dropdown-row">
                          <span className="account-dropdown-label">Recent Activity</span>
                          <button
                            type="button"
                            className="text-button"
                            onClick={markAllNotificationsRead}
                            disabled={!unreadNotificationCount || notificationsBusy}
                          >
                            {notificationsBusy ? "Updating..." : "Mark all read"}
                          </button>
                        </div>
                        {notifications.length ? (
                          <div className="account-notification-list">
                            {notifications.slice(0, 3).map((item) => (
                              <div
                                key={item.id}
                                className={`account-notification-card account-notification-card-${item.category || "system"} ${
                                  item.readAt ? "" : "account-notification-card-unread"
                                }`}
                              >
                                <div className="account-notification-meta">
                                  <span className={`notification-mini-pill notification-mini-pill-${item.category || "system"}`}>
                                    {item.category || "system"}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() => dismissNotification(item.id)}
                                    disabled={notificationsBusy}
                                  >
                                    Dismiss
                                  </button>
                                </div>
                                <button type="button" className="account-notification-open" onClick={() => openNotification(item)}>
                                  <strong>{item.title}</strong>
                                  <span>{item.body}</span>
                                  <small>{item.actionLabel || "Open context"}</small>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="panel-description">No new notifications yet.</p>
                        )}
                      </div>

                      <div className="account-dropdown-section">
                        <span className="account-dropdown-label">Workspace</span>
                        <div className="account-dropdown-links">
                          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                            Dashboard
                          </Link>
                          {isAdmin ? (
                            <Link href="/moderation" onClick={() => setMenuOpen(false)}>
                              Moderation
                            </Link>
                          ) : null}
                          <button type="button" className="text-button text-button-danger" onClick={handleSignOut}>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {!isMarketingHome ? (
          <div className="header-subbar">
            <div className="header-subbar-inner">
              <nav className="site-nav" aria-label="Primary navigation">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`site-nav-link ${isActivePath(pathname, item) ? "site-nav-link-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="workspace-strip" aria-label="Workspace summary">
                {workspaceChips.map((chip) => (
                  <Link key={chip.label} href={chip.href} className={`workspace-chip workspace-chip-${chip.tone}`}>
                    <span>{chip.label}</span>
                    <strong>{chip.value}</strong>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {!isMarketingHome && mobileNavOpen ? (
        <>
          <button type="button" className="shell-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />
          <aside className="shell-drawer" aria-label="Mobile navigation">
            <div className="shell-drawer-head">
              <div>
                <strong>{accountLabel}</strong>
                <p className="panel-description">{roleMeta.label}</p>
              </div>
              <button type="button" className="secondary-button shell-drawer-close" onClick={() => setMobileNavOpen(false)}>
                Close
              </button>
            </div>

            <div className="shell-drawer-section">
              <span className="account-dropdown-label">Navigate</span>
              <div className="shell-drawer-links">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className={isActivePath(pathname, item) ? "shell-drawer-link-active" : ""} onClick={() => setMobileNavOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="shell-drawer-section">
              <span className="account-dropdown-label">Your Workspace</span>
              <div className="shell-drawer-links">
                {drawerUtilities.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="shell-drawer-section">
              <span className="account-dropdown-label">Quick Stats</span>
              <div className="account-lane-summary">
                {workspaceChips.map((chip) => (
                  <div key={chip.label} className={`account-lane-chip account-lane-chip-${chip.tone}`}>
                    <span>{chip.label}</span>
                    <strong>{chip.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            {personas.length ? (
              <div className="shell-drawer-section">
                <span className="account-dropdown-label">Testing Personas</span>
                <div className="shell-drawer-links">
                  {personas.map((persona) => (
                    <button
                      key={persona.key}
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setDevPersona(persona);
                        setMobileNavOpen(false);
                        router.refresh();
                      }}
                    >
                      {persona.fullName} ({persona.role})
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="shell-drawer-foot">
              <Link href="/sell" className="sell-button" onClick={() => setMobileNavOpen(false)}>
                Sell an Item
              </Link>
              <button type="button" className="secondary-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <main className="page-shell">
        <div className="page-wrap">{children}</div>
      </main>
      <footer className="site-footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand-lockup">
              <span className="brand-mark" />
              <span className="brand-wordmark">UniKart</span>
            </Link>
            <p>
              The definitive campus-exclusive marketplace for safer buying, selling, renting, and peer-to-peer coordination.
            </p>
          </div>
          <div>
            <strong>Quick Links</strong>
            <div className="footer-links">
              <Link href="/">Home</Link>
              <Link href="/marketplace">Browse Listings</Link>
              <Link href="/sell">Sell an Item</Link>
              <Link href="/favorites">Saved Items</Link>
            </div>
          </div>
          <div>
            <strong>Support</strong>
            <div className="footer-links">
              <Link href="/support">Help Center & FAQs</Link>
              <Link href="/messages">Message Center</Link>
              <Link href="/policy">Safety & Trust</Link>
            </div>
          </div>
          <div>
            <strong>Legal</strong>
            <div className="footer-links">
              <Link href="/policy">Privacy Policy</Link>
              <Link href="/support">Terms of Service</Link>
              <Link href="/policy">Community Guidelines</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom-bar">
          <div className="footer-bottom-bar-inner">
            <p>&copy; {new Date().getFullYear()} UniKart Campus. All rights reserved.</p>
            <div className="footer-bottom-links">
              <Link href="/support">Contact Support</Link>
              <Link href="/dashboard">My Dashboard</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
