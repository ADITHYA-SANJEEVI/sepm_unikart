# Frontend V2 Implementation Checklist

## Product Tone

- Light mode first.
- Charcoal-led, warm off-white base.
- Quiet, premium, serviceable, mobile-aware.
- No second header row.
- No giant decorative system copy.
- No clutter, no box soup, no loud gradients.

## Core Visual Rules

- Background: warm off-white.
- Primary surfaces: soft ivory / pale stone.
- Primary text: deep charcoal.
- Secondary text: muted graphite.
- Premium accent: muted gold.
- Buying accent: slate blue.
- Safety accent: muted coral.
- Success accent: soft sage.
- Admin accent: graphite / steel.
- Rounded corners everywhere.
- Slight glass only for floating layers like dropdowns, sheets, and overlays.
- Motion must feel iPhone-level smooth: subtle, quick, nearly invisible.

## Header Rules

- One header row only.
- Left: logo and minimal workspace identity.
- Center: Dashboard, Browse, Sell, Messages.
- Right: Cart icon, Notifications bell, Profile dropdown.
- No top-nav Notifications link.
- No second utility row.
- No promotional sentence inside the header.

## Profile Dropdown Rules

- Internal scroll with sticky identity block.
- Compact sections with soft labels.
- Order:
  - Profile
  - Notifications
  - Saved
  - Compare
  - Meetups
  - Preferences
  - Support & Safety
  - Authentication
  - Admin tools if admin
  - Session controls

## Notifications Rules

- Bell icon in header.
- Compact scrollable bell panel.
- Categories:
  - Buying
  - Selling
  - Safety
  - System
  - Admin
- Soft tinted grouping and rounded cards.
- Full notifications page mirrors the same lane logic.

## Dashboard Rules

- Compact command-center intro.
- 60/40 desktop split.
- Single-column mobile.
- Bucket order:
  - Overview
  - Needs Action
  - Primary Workspace
  - Notifications Snapshot
  - Analytics Snapshot
  - Saved Searches / Compare / Meetups
  - Recommendations
  - Profile / Trust Health

## Marketplace Rules

- Before search: curated discovery.
- After search: search results workspace.
- Search activates filter rail automatically.
- Filter rail has its own scroll.
- Results top bar shows query, count, sort, and saved-search controls.
- Compare tray visible when queue is active.
- Listing cards support direct save, compare, and cart actions.
- Saved filters must support apply, edit, alert toggle, delete, and clear-all.

## Listing Card Rules

- Strong media first.
- Clear title and price.
- Quiet metadata.
- Consistent bottom alignment in grid.
- Heart save control with immediate state change.
- Direct compare control.
- Direct add-to-cart control.
- One obvious primary action.

## Listing Detail Rules

- Decision page, not prose wall.
- Clear trust / seller / status cluster.
- Media gallery with usable thumbnails.
- Tight action cluster:
  - Add to cart
  - Save
  - Compare
  - Message
  - Download PDF

## Saved Object Rules

- Anywhere user stores or curates state must support:
  - view
  - edit where meaningful
  - remove
  - clear
  - manage

Applies to:

- saved listings
- saved filters
- compare queue
- cart
- recently viewed where surfaced

## Motion Rules

- Button press bounce only.
- Tiny hover lift on actionable cards.
- Bell/dropdown/drawer slide and fade.
- Tooltip and snackbar fade.
- No ambient drifting objects.
- No decorative background motion on operational pages.

## Typography Rules

- Mostly sans.
- Serif only if extremely restrained.
- Strong but compact page titles.
- Quiet metadata and helper text.
- No oversized blown-up headings on routine pages.

## Smoothness Rules

- No dead clicks.
- Immediate visual feedback on save / compare / cart actions.
- Graceful loading skeletons or placeholder blocks.
- Minimal layout shift.
- Independent scroll containers for filters, dropdowns, and long utility panes.
- Cache repeated reads when safe.
- Invalidate cache on mutating actions.

## First Hardening Sweep

- Replace two-row shell with single-row header.
- Add cart icon and bell dropdown.
- Remove loud backend/system pills from user-facing shell.
- Reduce heading sizes and serif usage.
- Tighten global spacing and surface rhythm.
- Add notification inbox summary to header.
- Add cart count to header.
- Add saved-filter management controls.
- Add direct card add-to-cart.
- Convert save control to heart-style interaction.
- Add compare guidance message after toggle.
- Give filter rail independent scroll.
- Add lightweight GET caching and mutation invalidation.
