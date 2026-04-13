"use client";

import { useEffect, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { SelectField } from "@/components/system/select-field";

export function V2AuthPage() {
  const { auth, setAuth, signInWithMagicLink, setDevPersona, signOut, signedInLike } = useV2AppState();
  const [email, setEmail] = useState(auth.devEmail || auth.user?.email || "");
  const [devRole, setDevRole] = useState(auth.devRole || "buyer");
  const [devFullName, setDevFullName] = useState(auth.devFullName || "");
  const [overrideSecret, setOverrideSecret] = useState(auth.overrideSecret || "");
  const [personas, setPersonas] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/backend/auth/debug-bypass-status")
      .then((response) => response.json())
      .then((payload) => setPersonas(payload?.data?.testPersonas || []))
      .catch(() => setPersonas([]));
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function sendMagicLink(event) {
    event.preventDefault();
    setBusy("magic");
    const result = await signInWithMagicLink(email);
    setMessage(result.message);
    setBusy("");
  }

  function saveDevAccess() {
    setAuth((current) => ({
      ...current,
      devEmail: String(email || "").trim().toLowerCase(),
      devRole,
      devFullName,
      loading: false,
    }));
    setMessage(email ? "Local test session updated." : "Test session cleared.");
  }

  function applyOverride() {
    setAuth((current) => ({
      ...current,
      overrideSecret: String(overrideSecret || "").trim(),
      loading: false,
    }));
    setMessage(overrideSecret.trim() ? "Admin override applied in this browser." : "Admin override cleared.");
  }

  const roleTone =
    auth.profile?.role === "admin" || auth.devRole === "admin"
      ? "admin"
      : auth.profile?.role === "seller" || auth.devRole === "seller"
        ? "selling"
        : "buying";

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Access"
        title="Sign in, switch test accounts, or use admin access from one place."
        description="Manage your account access securely."
      />

      {message ? <p className="v2-summary-note">{message}</p> : null}

      <div className="v2-dashboard-grid">
        <Surface title="Current session" description="See exactly which account is active in this browser.">
          {signedInLike ? (
            <div className="v2-inline-list">
              <div className="v2-inline-row">
                <div>
                  <strong>{auth.profile?.fullName || auth.user?.email || auth.devFullName || auth.devEmail || "Local session"}</strong>
                  <span>{auth.profile?.role || auth.devRole || "buyer"} account active in this browser.</span>
                </div>
                <div className="v2-stack-inline">
                  <StatusPill tone={roleTone}>{auth.profile?.role || auth.devRole || "buyer"}</StatusPill>
                  {auth.overrideSecret ? <StatusPill tone="admin">override active</StatusPill> : null}
                </div>
              </div>
            </div>
          ) : (
            <EmptyBlock title="No active session" description="Use a magic link or a test account to sign in." />
          )}
          <div className="v2-page-header-actions">
            <Button variant="secondary" onClick={signOut}>Clear session</Button>
          </div>
        </Surface>

        <Surface title="Campus sign in" description="Use a magic link when Supabase auth is configured for this browser.">
          <form className="v2-field-stack" onSubmit={sendMagicLink}>
            <label className="v2-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="yourname@srmist.edu.in" />
            </label>
            <Button type="submit" disabled={busy === "magic"}>{busy === "magic" ? "Sending..." : "Send magic link"}</Button>
          </form>
        </Surface>
      </div>

      <div className="v2-dashboard-grid">
        <Surface title="Test accounts" description="Switch quickly between buyer, seller, and admin sessions during local testing.">
          {personas.length ? (
            <div className="v2-utility-grid">
              {personas.map((persona) => (
                <button
                  key={persona.key}
                  type="button"
                  className="v2-tool-link v2-tool-link-button"
                  onClick={() => {
                    setDevPersona(persona);
                    setEmail(persona.email);
                    setDevRole(persona.role);
                    setDevFullName(persona.fullName);
                    setMessage(`${persona.fullName} loaded.`);
                  }}
                >
                  <strong>{persona.fullName}</strong>
                  <span>{persona.role} / {persona.email}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="v2-field-grid">
            <label className="v2-field">
              <span>Test email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="demo@srmist.edu.in" />
            </label>
            <label className="v2-field">
              <span>Role</span>
              <SelectField
                value={devRole}
                onChange={setDevRole}
                options={[
                  { value: "buyer", label: "Buyer" },
                  { value: "seller", label: "Seller" },
                  { value: "admin", label: "Admin" },
                ]}
              />
            </label>
          </div>

          <label className="v2-field">
            <span>Display name</span>
            <input value={devFullName} onChange={(event) => setDevFullName(event.target.value)} placeholder="Seller demo" />
          </label>

          <div className="v2-page-header-actions">
            <Button onClick={saveDevAccess}>Save local session</Button>
            <Button variant="ghost" onClick={() => {
              setEmail("");
              setDevFullName("");
              setDevRole("buyer");
              setMessage("Fields cleared.");
            }}>
              Clear fields
            </Button>
          </div>
        </Surface>

        <Surface title="Admin access" description="Manage elevated system access.">
          <div className="v2-field-stack">
            <label className="v2-field">
              <span>Override secret</span>
              <input value={overrideSecret} onChange={(event) => setOverrideSecret(event.target.value)} placeholder="Admin override secret" />
            </label>
            <div className="v2-page-header-actions">
              <Button variant="secondary" onClick={applyOverride}>Apply override</Button>
              <Button variant="ghost" onClick={() => {
                setOverrideSecret("");
                setAuth((current) => ({ ...current, overrideSecret: "", loading: false }));
                setMessage("Admin override cleared.");
              }}>
                Clear override
              </Button>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
