"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { V2CompareOverlay } from "@/components/compare/v2-compare-overlay";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, Icon, IconButton, StatusPill } from "@/components/system/primitives";

const primaryNav = [
  { href: "/", label: "Explore" },
  { href: "/marketplace", label: "Listings" },
  { href: "/sell", label: "Sell" },
  { href: "/favorites", label: "Saved" },
  { href: "/messages", label: "Messages" },
  { href: "/support", label: "Trust" },
];

function getInitial(name) {
  return String(name || "U").trim().charAt(0).toUpperCase() || "U";
}

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getLaneTone(lane) {
  if (lane === "buying") return "buying";
  if (lane === "selling") return "selling";
  if (lane === "safety") return "safety";
  if (lane === "admin") return "admin";
  return "neutral";
}

function getNotificationHref(item) {
  if (item.actionHref) return item.actionHref;
  if (item.entityType === "listing" && item.entityId) return `/listings/${item.entityId}`;
  if (item.entityType === "conversation") return "/messages";
  if (item.entityType === "schedule") return "/schedules";
  return "/notifications";
}

function getShellTone(pathname) {
  if (pathname === "/" || pathname === "/marketplace") return "immersive";
  if (pathname === "/sell" || pathname.startsWith("/listings/")) return "studio";
  if (pathname === "/messages" || pathname === "/favorites" || pathname.startsWith("/profiles/")) return "soft";
  if (pathname === "/moderation" || pathname === "/platform-analytics" || pathname === "/ai-lab") return "quiet";
  return "balanced";
}

export function V2Shell({ children }) {
  const pathname = usePathname();
  const {
    health,
    auth,
    appReady,
    cartCount,
    notificationInbox,
    compareIds,
    compareOverlayOpen,
    openCompareOverlay,
    closeCompareOverlay,
    setDevPersona,
    signOut,
    signedInLike,
  } = useV2AppState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [personas, setPersonas] = useState([]);
  const menuRef = useRef(null);
  const bellRef = useRef(null);
  const accountLabel = auth.profile?.fullName || auth.user?.email || auth.devFullName || auth.devEmail || "Guest";
  const roleLabel = auth.profile?.role || auth.devRole || "buyer";
  const navItems = roleLabel === "admin" ? [...primaryNav, { href: "/platform-analytics", label: "Platform" }] : primaryNav;
  const shellTone = getShellTone(pathname);
  const unreadCount = notificationInbox?.counts?.unread || 0;
  const laneCards = useMemo(
    () =>
      ["buying", "selling", "safety", "system", "admin"]
        .map((lane) => ({
          lane,
          total: notificationInbox?.counts?.[lane] || 0,
          urgent: notificationInbox?.[lane]?.needsAction?.length || 0,
        }))
        .filter((item) => item.total > 0),
    [notificationInbox],
  );
  const previewItems = useMemo(
    () => [
      ...(notificationInbox?.all?.needsAction || []),
      ...(notificationInbox?.all?.recent || []),
    ].slice(0, 5),
    [notificationInbox],
  );

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setBellOpen(false);
    closeCompareOverlay();
  }, [pathname]);

  useEffect(() => {
    function handleOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    fetch("/api/backend/auth/debug-bypass-status")
      .then((response) => response.json())
      .then((payload) => setPersonas(payload?.data?.testPersonas || []))
      .catch(() => setPersonas([]));
  }, []);

  const profileHref = auth.profile ? `/profiles/${auth.profile.id}` : "/auth";
  const workspaceLinks = [
    { href: profileHref, label: "Profile" },
    { href: "/notifications", label: `Notifications${unreadCount ? ` (${unreadCount})` : ""}` },
    { href: "/messages", label: "Messages" },
    { href: "/favorites", label: "Saved" },
    { href: "/compare", label: `Compare${compareIds.length ? ` (${compareIds.length})` : ""}` },
    { href: "/cart", label: `Cart${cartCount ? ` (${cartCount})` : ""}` },
    { href: "/schedules", label: "Meetups" },
  ];
  const accountLinks = [{ href: "/auth", label: "Authentication" }];
  const adminLinks =
    roleLabel === "admin"
      ? [
          { href: "/moderation", label: "Moderation" },
          { href: "/platform-analytics", label: "Platform Analytics" },
          { href: "/ai-lab", label: "AI Diagnostics" },
        ]
      : [];

  if (!appReady) {
    return (
      <div className="v2-boot-screen">
        <div className="v2-boot-card">
          <div className="v2-boot-brand">
            <span className="v2-brand-mark" />
            <strong>UniKart</strong>
          </div>
          <h1>Preparing your workspace</h1>
          <p>Loading account state, notifications, cart, and the latest marketplace data before the interface becomes interactive.</p>
          <div className="v2-boot-progress">
            <span className="v2-spinner" aria-hidden="true" />
            <span>{health.loading ? "Checking backend health..." : signedInLike ? "Warming your workspace..." : "Warming browse data..."}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`v2-shell v2-shell-tone-${shellTone}`}>
      <div className="v2-ambient-stage" aria-hidden="true">
        <span className="v2-ambient-blob v2-ambient-blob-a" />
        <span className="v2-ambient-blob v2-ambient-blob-b" />
        <span className="v2-ambient-blob v2-ambient-blob-c" />
        <span className="v2-ambient-blob v2-ambient-blob-d" />
        <span className="v2-ambient-grain" />
      </div>
      <header className="v2-header">
        <div className="v2-header-row">
          <div className="v2-header-brand-row">
            <button
              type="button"
              className="v2-mobile-toggle"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileOpen((current) => !current)}
            >
              <Icon name={mobileOpen ? "close" : "menu"} />
            </button>
            <Link href="/" className="v2-brand">
              <span className="v2-brand-mark" />
              <span>UniKart</span>
            </Link>
            {signedInLike ? (
              <StatusPill tone={roleLabel === "admin" ? "admin" : roleLabel === "seller" ? "selling" : "buying"}>{roleLabel}</StatusPill>
            ) : null}
            {!health.loading && !health.backend ? <StatusPill tone="safety">offline</StatusPill> : null}
          </div>

          <nav className="v2-nav" aria-label="Primary">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "v2-nav-link v2-nav-link-active" : "v2-nav-link"}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="v2-header-actions">
            <IconButton
              icon="compare"
              label="Open compare"
              badge={compareIds.length ? String(compareIds.length) : ""}
              active={compareOverlayOpen}
              onClick={() => {
                if (!compareIds.length) return;
                openCompareOverlay();
              }}
            />
            <IconButton href="/cart" icon="cart" label="Open cart" badge={cartCount ? String(cartCount) : ""} />

            <div className="v2-floating-panel-wrap" ref={bellRef}>
              <IconButton
                icon="bell"
                label="Open notifications"
                badge={unreadCount ? String(unreadCount) : ""}
                active={bellOpen}
                onClick={() => setBellOpen((current) => !current)}
              />
              {bellOpen ? (
                <div className="v2-floating-panel v2-bell-panel">
                  <div className="v2-floating-panel-head">
                    <div>
                      <strong>Notifications</strong>
                      <p>Buying, selling, safety, and system updates appear here first.</p>
                    </div>
                    <Button href="/notifications" variant="secondary">View all</Button>
                  </div>

                  {laneCards.length ? (
                    <div className="v2-notification-lanes">
                      {laneCards.map((lane) => (
                        <Link key={lane.lane} href={`/notifications?lane=${lane.lane}`} className={`v2-notification-lane v2-notification-lane-${lane.lane}`}>
                          <div>
                            <strong>{lane.lane}</strong>
                            <span>{lane.urgent ? `${lane.urgent} urgent` : "up to date"}</span>
                          </div>
                          <small>{lane.total}</small>
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  <div className="v2-floating-panel-list">
                    {previewItems.length ? (
                      previewItems.map((item) => (
                        <Link key={item.id} href={getNotificationHref(item)} className="v2-floating-item">
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.body}</span>
                          </div>
                          <StatusPill tone={getLaneTone(item.lane)}>{item.lane}</StatusPill>
                        </Link>
                      ))
                    ) : (
                      <div className="v2-floating-empty">
                        <strong>No fresh notifications</strong>
                        <span>Updates that need action will appear here first.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="v2-account-menu" ref={menuRef}>
              <button type="button" className="v2-account-pill" onClick={() => setAccountOpen((current) => !current)}>
                <span className="v2-account-pill-avatar">{getInitial(accountLabel)}</span>
                <span className="v2-account-pill-copy">
                  <strong>{accountLabel}</strong>
                  <small>{signedInLike ? roleLabel : "guest"}</small>
                </span>
              </button>
              {accountOpen ? (
                <div className="v2-floating-panel v2-account-dropdown">
                  <div className="v2-account-dropdown-head">
                    <div className="v2-account-hero">
                      <span className="v2-account-hero-avatar">{getInitial(accountLabel)}</span>
                      <div>
                        <strong>{accountLabel}</strong>
                        <p>{auth.profile?.sellerHeadline || auth.profile?.bio || "Saved items, account tools, and secure in-app activity."}</p>
                      </div>
                    </div>
                    <div className="v2-account-status-row">
                      <StatusPill tone={roleLabel === "admin" ? "admin" : roleLabel === "seller" ? "selling" : "buying"}>{roleLabel}</StatusPill>
                      {auth.profile?.isVerified ? <StatusPill tone="selling">verified</StatusPill> : null}
                    </div>
                  </div>

                  <div className="v2-account-scroll">
                    <div className="v2-account-section">
                      <span>Workspace</span>
                      {workspaceLinks.map((item) => (
                        <Link key={item.href} href={item.href} className="v2-account-link">
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    <div className="v2-account-section">
                      <span>Account</span>
                      {accountLinks.map((item) => (
                        <Link key={item.href} href={item.href} className="v2-account-link">
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    {adminLinks.length ? (
                      <div className="v2-account-section">
                        <span>Admin</span>
                        {adminLinks.map((item) => (
                          <Link key={item.href} href={item.href} className="v2-account-link">
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}

                    {personas.length ? (
                      <div className="v2-account-section">
                        <span>Test Personas</span>
                        {personas.map((persona) => (
                          <button
                            key={persona.key}
                            type="button"
                            className="v2-account-link v2-account-link-button"
                            onClick={() => {
                              setDevPersona(persona);
                              setAccountOpen(false);
                            }}
                          >
                            {persona.fullName} ({persona.role})
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="v2-account-section">
                      <span>Session</span>
                      {signedInLike ? (
                        <button
                          type="button"
                          className="v2-account-link v2-account-link-button"
                          onClick={async () => {
                            await signOut();
                            setAccountOpen(false);
                          }}
                        >
                          Continue as guest
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <>
          <button type="button" className="v2-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="v2-mobile-drawer">
            <div className="v2-mobile-drawer-head">
              <div>
                <strong>UniKart</strong>
                <p>{auth.profile?.fullName || auth.user?.email || auth.devEmail || "Guest session"}</p>
              </div>
              <Button variant="secondary" onClick={() => setMobileOpen(false)}>Close</Button>
            </div>
            <div className="v2-mobile-drawer-section">
              <span>Primary</span>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "v2-mobile-link v2-mobile-link-active" : "v2-mobile-link"}>
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="v2-mobile-drawer-section">
              <span>Workspace</span>
              <Link href="/cart" className="v2-mobile-link">Cart</Link>
              <Link href="/notifications" className="v2-mobile-link">Notifications</Link>
              <Link href="/favorites" className="v2-mobile-link">Saved</Link>
              <Link href="/compare" className="v2-mobile-link">Compare</Link>
              <Link href="/schedules" className="v2-mobile-link">Meetups</Link>
              <Link href={profileHref} className="v2-mobile-link">Profile</Link>
            </div>
          </aside>
        </>
      ) : null}

      <main className="v2-main">
        <div className="v2-main-wrap page-enter">{children}</div>
      </main>

      <V2CompareOverlay open={compareOverlayOpen} onClose={closeCompareOverlay} />

      <nav className="v2-mobile-bottom-nav" aria-label="Mobile">
        {[
          { href: "/", label: "Home", icon: "home" },
          { href: "/marketplace", label: "Search", icon: "search" },
          { href: "/sell", label: "Sell", icon: "plus-square" },
          { href: "/messages", label: "Chats", icon: "message-square" },
          { href: profileHref, label: "Profile", icon: "user" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(pathname, item.href) ? "v2-mobile-bottom-link v2-mobile-bottom-link-active" : "v2-mobile-bottom-link"}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <footer className="v2-footer site-footer">
        <div className="v2-footer-wrap footer-grid">
          <div className="footer-brand">
            <strong>UniKart</strong>
            <p>The trusted campus marketplace for faster, safer peer-to-peer transactions.</p>
          </div>
          <div className="v2-footer-links">
            <Link href="/support">Support & Trust</Link>
            <Link href="/policy">Safety & Policy</Link>
            <Link href="/notifications">System Activity</Link>
            <Link href="/auth">Access Control</Link>
          </div>
        </div>
        <div className="footer-bottom-bar">
          <div className="footer-bottom-bar-inner">
            <p>Copyright {new Date().getFullYear()} UniKart Campus Application. Internal prototype.</p>
            <div className="footer-bottom-links">
              <Link href="/ai-lab">AI Lab</Link>
              <Link href="/platform-analytics">System Status</Link>
              <Link href="/moderation">Platform Moderation</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
