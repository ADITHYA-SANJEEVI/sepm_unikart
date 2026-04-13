# UniKart Next-Phase Execution Plan

This document captures the next essential work for UniKart after the current MVP stabilization pass. It is intentionally written as an execution brief rather than a casual backlog note, so any engineer or AI agent can use it to continue the project without losing product intent.

Supabase modifications are explicitly allowed through the configured MCP server wherever necessary for implementation. That includes schema changes, migrations, secure read models, storage configuration, analytic views, and other database-side work required to make the product correct, scalable, and testable.

The current assumption is:
- the product is demonstrable
- the core marketplace and listing studio exist
- several account, admin, navigation, and testing flows still need to be hardened
- compare remains present in the UI but is not yet reliable enough to be treated as a trustworthy buyer workflow
- a broader UI revamp may happen later, but the platform must first become behaviorally coherent and operationally testable

---

## 1. Current Strategic Context

UniKart is no longer a blank prototype. It now has:
- a real campus marketplace
- listing creation and editing
- favorites, cart, messages, schedules, compare, and moderation surfaces
- Supabase-backed persistence
- a stronger sell flow

However, the product is not yet at the point where all critical flows are:
- fully redundant where they should be
- minimally redundant where they should not be
- operationally testable with two real users
- admin-enforceable
- polished in account/personal utility flows
- exportable/documentable for trust and safety use cases

The next phase is therefore about:
- governance
- user control
- operational clarity
- testing readiness
- eliminating ambiguous ownership of features

---

## 2. Priority Themes

The next work is organized into seven priority themes:

1. Seller info and safety PDF export
2. Navigation redundancy and information architecture cleanup
3. Maximum user control over user-owned objects
4. Real admin privilege enforcement
5. Dual-user login/testing model
6. Compare flow reliability and buyer decision tooling
7. Performance, caching, alerts, and analytics

Each one is documented below with:
- problem statement
- target outcome
- implementation direction
- acceptance criteria
- test cases

---

## 3. Priority 1: Seller Info + Safety PDF Export

### 3.1 Problem

The product currently shows seller information, listing detail, and safety guidance in the UI, but there is no exportable artifact that:
- a buyer can save
- a seller can share
- an admin can review
- a professor/demo evaluator can inspect as an example of trust-and-safety thinking

This creates a presentation and operational gap.

### 3.2 Goal

Allow the platform to generate a clean downloadable PDF containing:
- seller profile snapshot
- listing summary
- transaction-relevant metadata
- safety and meetup guidance
- optional policy reminders

### 3.3 Intended Use Cases

- Buyer downloads a safety-aware seller summary before meetup
- Seller downloads their listing packet for offline coordination
- Admin exports evidence context for moderation review
- Demo/testing users show trust features in a portable format

### 3.4 Scope

Minimum export content:
- seller full name
- seller trust signals
- seller campus identity fields that are safe to expose
- listing title
- listing price / mode / condition / area
- listing status
- quantity available
- timestamps
- safety guidelines
- prohibited / caution reminders

Nice-to-have:
- listing image
- QR or shareable deep link
- report contact path

### 3.5 Implementation Direction

Recommended implementation:
- backend-driven PDF generation route
- one or more export types:
  - listing packet PDF
  - seller profile packet PDF
  - moderation evidence packet PDF
- PDF generation must not rely on frontend screenshots

### 3.6 Acceptance Criteria

- A user can download a seller/listing PDF from the relevant surface
- The PDF contains accurate current backend data, not stale frontend-only state
- The PDF contains safety guidance and trust metadata
- The PDF renders cleanly on desktop and mobile-generated flows
- Exporting does not expose private fields that should remain hidden

### 3.7 Test Cases

#### TC-PDF-001
Title: Download listing packet from listing detail  
Precondition: Active listing exists with seller profile data  
Steps:
1. Open listing detail
2. Click download/export
3. Save PDF
Expected:
- PDF downloads successfully
- listing title, price, seller name, condition, mode, and area are correct
- safety guidance is present

#### TC-PDF-002
Title: Export reflects latest listing update  
Precondition: Listing exists and has been edited  
Steps:
1. Edit listing title or price
2. Open export
3. Download PDF
Expected:
- PDF shows the updated values
- no stale metadata appears

#### TC-PDF-003
Title: Private seller data is not leaked  
Precondition: Seller profile has both public and internal fields  
Steps:
1. Download seller/listing packet
2. Inspect exported fields
Expected:
- only approved public/trust fields appear
- no secrets, internal IDs, or unsafe personal data are exposed

---

## 4. Priority 2: Navigation Redundancy and Information Architecture Cleanup

### 4.1 Problem

The app currently contains overlapping access paths:
- header links
- dashboard quick links
- account menu / profile routes
- page-level actions

Some redundancy is good. Current redundancy is not consistently intentional.

### 4.2 Goal

Find the right level of redundancy:
- important routes remain easy to access
- personal features live under the account layer where appropriate
- global navigation stays focused
- no surface feels like a duplicate junk drawer

### 4.3 Target Navigation Model

#### Global navigation
Should contain only app-wide surfaces:
- Dashboard
- Browse
- Support
- Safety
- Moderation only for admin

#### Personal/account menu
Should contain user-scoped utilities:
- My Profile
- My Listings
- Saved Listings
- Compare Queue
- Messages
- Meetups
- Notifications
- Account Settings
- Sign Out

#### Dashboard
Should provide shortcuts, not replace primary navigation.

### 4.4 Acceptance Criteria

- No key personal action is discoverable only from one obscure route
- Personal/account features are primarily accessed from the avatar menu or dashboard
- Global nav does not feel overloaded
- Moderation is not visible for normal users
- The same destination is not unnecessarily repeated in 4-5 locations without reason

### 4.5 Test Cases

#### TC-NAV-001
Title: Personal feature discoverability  
Steps:
1. Log in as buyer or seller
2. Open avatar menu
Expected:
- user can access profile, listings, saved, compare, messages, and meetups from there

#### TC-NAV-002
Title: Admin-only route isolation  
Steps:
1. Log in as normal user
2. Inspect nav and dropdown
Expected:
- moderation is hidden

#### TC-NAV-003
Title: Navigation redundancy sanity  
Steps:
1. Inspect header, dashboard, and account menu
Expected:
- major routes are accessible
- route duplication feels deliberate, not messy

---

## 5. Priority 3: Maximum User Control Over User-Owned Objects

### 5.1 Problem

Several user-owned objects still behave like fixed system outputs rather than user-managed assets. Examples:
- saved filters
- compare queues
- listings
- profile sections
- notification states

### 5.2 Goal

Wherever the object belongs to the user, the user should generally have full lifecycle control:
- rename
- edit
- delete
- archive
- clear
- reorder if useful

### 5.3 Scope

This principle should apply to:
- saved filters
- compare queue
- my listings
- profile data
- notifications
- favorites collections if introduced later

### 5.4 Desired Behaviors

#### Saved filters
- create
- custom label
- rename
- delete
- clear all

#### Compare queue
- add from listing card
- add from listing detail
- remove individual item
- clear compare queue
- preserve queue across relevant navigations
- show obvious empty, full, and incompatible states

#### My listings
- edit
- delete
- mark sold
- relist
- archive
- duplicate
- show last modified metadata
- expose stronger listing performance context
- show moderation-imposed state clearly
- support richer seller-side management actions without forcing route hopping

#### Notifications
- mark read
- mark all read
- dismiss if appropriate
- separate buying, selling, safety, and system contexts
- support direct actions from notification cards

### 5.5 Acceptance Criteria

- Every major user-owned object has a clear management path
- Naming and editing is user-driven, not system-imposed
- Delete actions are available where safe and clearly confirmed
- Metadata updates propagate correctly after changes
- compare queue can be managed without local-state confusion or silent resets
- seller workspace behaves like a real control center rather than just a listing dump

### 5.6 Test Cases

#### TC-CTRL-001
Title: Rename saved filter  
Steps:
1. Save a filter
2. Rename it
Expected:
- new name appears everywhere that filter is rendered

#### TC-CTRL-002
Title: Mark listing sold  
Steps:
1. Open My Listings
2. Mark a listing sold
Expected:
- listing status updates immediately
- updated metadata changes
- saved users receive notification

#### TC-CTRL-003
Title: Delete listing  
Steps:
1. Open My Listings
2. Delete a listing
Expected:
- listing disappears from seller listing workspace
- listing disappears from buyer-facing surfaces
- saved users are notified

#### TC-CTRL-004
Title: Manage compare queue  
Steps:
1. Add two listings to compare
2. Remove one listing
3. Clear the compare queue
Expected:
- queue updates immediately
- compare state is consistent across listing cards, detail pages, and compare route
- no stale compared state remains on removed listings

---

## 6. Priority 4: Admin Privileges Must Actually Work

### 6.1 Problem

Admin tooling has historically had truth gaps:
- admin actions recorded but did not affect listings
- admin visibility not always enforced cleanly
- moderation outcome not consistently reflected in marketplace surfaces

### 6.2 Goal

Admin actions must produce real system effects.

### 6.3 Required Admin Powers

- hide or suspend listing
- warn user
- resolve report
- inspect related listing/seller context
- see moderation history
- see audit trail

### 6.4 Correct System Behavior

If an admin hides or suspends a listing:
- listing should not appear in normal buyer marketplace queries
- listing status/visibility should reflect moderation action
- seller should see the state clearly in My Listings
- moderation history should remain auditable

### 6.5 Acceptance Criteria

- Admin-only routes are protected
- Admin actions mutate actual listing/account state where intended
- Marketplace respects moderation status
- Seller workspace reflects moderation-imposed state
- Moderation notes/history remain queryable

### 6.6 Test Cases

#### TC-ADMIN-001
Title: Hide listing from moderation desk  
Steps:
1. Log in as admin
2. Open report for listing
3. Apply hide action
Expected:
- listing no longer appears in buyer marketplace
- seller still sees moderated state in seller workspace if intended

#### TC-ADMIN-002
Title: Non-admin cannot access moderation  
Steps:
1. Log in as normal user
2. Attempt to access moderation route
Expected:
- access denied or route hidden

#### TC-ADMIN-003
Title: Moderation action remains auditable  
Steps:
1. Apply moderation action
2. Open moderation history
Expected:
- action type, admin, note, and timestamp are visible

---

## 7. Priority 5: Dual-User Login Model for Interactive Testing

### 7.1 Problem

UniKart is inherently multi-actor:
- buyer
- seller
- admin

Several critical flows cannot be tested convincingly with a single identity:
- chat
- saved listing notifications
- seller/buyer trust visibility
- report flow
- hold flow
- compare and buy decisions

### 7.2 Goal

Provide a stable testing model with at least two normal users plus admin access.

### 7.3 Recommended Testing Identities

- Test Seller A
- Test Buyer B
- Admin / Moderator

### 7.4 Acceptable Solutions

Option A:
- seeded dev identities
- simple role-aware quick login panel for local/demo mode

Option B:
- magic link auth with two known test inboxes

Option C:
- local developer account switcher for demo mode only

### 7.5 Acceptance Criteria

- At least two independent user identities can be used in the same environment
- The system can simulate:
  - one user listing an item
  - another user saving it
  - first user marking it sold
  - second user receiving notification
- Admin can separately inspect moderation behavior

### 7.6 Test Cases

#### TC-MULTI-001
Title: Seller to buyer saved-notification flow  
Steps:
1. Seller publishes listing
2. Buyer saves listing
3. Seller marks listing sold
Expected:
- buyer receives sold notification

#### TC-MULTI-002
Title: Buyer-seller chat flow  
Steps:
1. Buyer opens listing
2. Buyer opens chat
3. Seller replies under second account
Expected:
- thread persists correctly under both users

#### TC-MULTI-003
Title: Admin moderation under third identity  
Steps:
1. Buyer reports listing
2. Admin opens moderation desk
3. Admin resolves report
Expected:
- report status changes
- listing state changes if action demands it

---

## 8. Priority 6: Compare Flow Reliability and Buyer Decision Tooling

### 8.1 Problem

The compare feature exists conceptually and in the UI, but is not yet trustworthy as a buyer workflow. Current symptoms include:
- compare add/remove behavior that does not always persist predictably
- listing cards and compare route falling out of sync
- compare state not always surviving navigation
- insufficient buyer-facing explanation of why listings differ

### 8.2 Goal

Turn compare into a real buyer decision workspace rather than a fragile local convenience.

### 8.3 Required Behaviors

- add listings to compare from cards and detail pages
- maintain a clear compare count in shared app state
- limit compare queue to a sane maximum
- allow remove and clear actions
- preserve compared state across route transitions
- render side-by-side differences in price, condition, mode, quantity, seller trust, and meetup options
- clearly explain when compared items are incompatible or no longer available

### 8.4 Acceptance Criteria

- compare is visibly reliable across marketplace, detail, favorites, dashboard, and compare route
- compare queue does not silently clear during normal navigation
- compare actions are reversible and obvious
- unavailable or moderated listings are handled gracefully
- compare output helps a buyer decide, not just visually place cards side by side

### 8.5 Test Cases

#### TC-COMPARE-001
Title: Add from browse and open compare  
Steps:
1. Add two listings to compare from marketplace cards
2. Open compare route
Expected:
- both listings appear in compare workspace
- compared state is still reflected on the source cards

#### TC-COMPARE-002
Title: Cross-route compare persistence  
Steps:
1. Add listing A from browse
2. Open listing B detail
3. Add listing B from detail
4. Navigate to compare
Expected:
- both listings appear
- no earlier compared item is lost

#### TC-COMPARE-003
Title: Remove and clear compare queue  
Steps:
1. Add multiple listings to compare
2. Remove one listing
3. Clear the queue
Expected:
- queue updates immediately
- all compared-state badges/actions reset correctly across the app

---

## 9. Priority 7: Performance, Caching, Alerts, and Analytics

### 9.1 Problem

The product still feels slower than it should in places where user intent is obvious:
- listing detail opens with perceptible delay
- seller/profile context can feel cold-loaded
- repeated navigation can trigger unnecessary re-fetches
- important read surfaces do not yet behave like a warmed application shell

There is also no fully formalized analytics layer for:
- sellers
- buyers
- moderators/admins
- product-wide operational visibility

Saved search alerts are also missing as a retention and discovery tool.

### 9.2 Goal

Make UniKart feel aggressively responsive while also making the platform observable and actionable.

This theme has four sub-goals:
- warm the app through caching and prefetch
- reduce perceived and actual read latency
- add saved-search alert capability
- provide analytics for seller, buyer, moderator, and platform views

### 9.3 Required Caching and Prefetch Scope

The following surfaces should be treated as prefetch/caching candidates:
- marketplace listing collections
- listing detail payloads
- seller profile payloads
- saved/favorites state
- cart summary and count
- compare state
- dashboard summaries
- notifications
- saved filters
- recently viewed
- meetups and message thread summaries where justified

### 9.4 Performance Expectations

- initial app boot should warm the highest-probability surfaces
- hover/viewport-driven prefetch should be used where it improves perceived speed
- repeated navigation should prefer short-lived cache reuse over full cold refetch
- the app should use bounded caches and request deduplication to avoid CPU/memory abuse
- performance work must not create stale-truth bugs after mutation

### 9.5 Saved Search Alerts

Users should be able to save discovery intent and be notified when matching listings appear.

Minimum requirements:
- save a search/filter preset
- label it
- enable or disable alerts
- notify when new matching listings arrive
- later support digest mode or instant mode

### 9.6 Analytics Scope

#### Seller analytics
- listing views
- saves
- chats started
- holds requested
- meetups scheduled
- sold/reserved conversions
- price change effects
- listing quality vs performance

#### Buyer analytics
- saved listing changes
- price-drop or availability notifications
- recently viewed trends
- compare activity
- interest/category signals where useful

#### Moderator/Admin analytics
- open reports
- report categories and severity distribution
- moderation turnaround time
- repeat offender patterns
- risky listing/chat trends
- listing hide/suspend actions over time
- conversion and abuse heatmaps by category

#### Platform analytics
- daily active users
- listings created, updated, sold, hidden, deleted
- view -> save -> chat -> hold -> sold funnel
- category supply/demand imbalance
- feature usage for saved filters, compare, AI, cart, and chat
- dashboard usage and notification engagement

### 9.7 Moderator/Admin Data Access Model

Moderator analytics must feel direct and powerful, but access must remain secure.

Approved direction:
- direct frontend connection only through secure Supabase-authenticated, role-scoped access
- prefer RLS-backed analytic views, secure read models, or controlled backend/admin routes
- do not expose unrestricted raw admin data access in the client

The experience goal is "front-end direct and fast," but the enforcement model must still remain role-safe and auditable.

### 9.8 Acceptance Criteria

- high-probability read surfaces feel materially faster on repeated navigation
- prefetch/caching strategy covers listing detail, seller detail, dashboard, and key user state
- saved search alerts can be created, managed, and triggered
- seller analytics exist in a usable summary format
- moderator analytics exist with secure role-scoped access
- platform analytics can answer core product and safety questions

### 9.9 Test Cases

#### TC-PERF-001
Title: Listing detail warm navigation  
Steps:
1. Open marketplace
2. Hover or focus a listing card
3. Open the listing
Expected:
- detail feels substantially faster than a cold open
- no duplicate visible loading cascade appears

#### TC-PERF-002
Title: Seller profile cache reuse  
Steps:
1. Open seller profile from listing detail
2. Navigate away
3. Return to the same seller
Expected:
- second navigation reuses short-lived cache appropriately
- no stale or contradictory seller data appears

#### TC-ALERT-001
Title: Saved search alert trigger  
Steps:
1. Save a search with alerts enabled
2. Create a matching listing
Expected:
- user receives a notification for the matching listing

#### TC-ANALYTICS-001
Title: Seller analytics summary  
Steps:
1. Open seller workspace
2. Inspect analytics for a listing with interactions
Expected:
- views, saves, chats, and conversions appear with current data

#### TC-ANALYTICS-002
Title: Moderator analytics access control  
Steps:
1. Open moderator analytics as admin
2. Attempt access as non-admin
Expected:
- admin sees analytics
- non-admin is denied or the route is hidden

---

## 10. Notification Taxonomy and Inbox Design

### 10.1 Why This Section Exists

UniKart now needs a real notification system, not a generic alert list. Notifications must reflect role, urgency, and actionability while remaining visually calm and premium.

### 10.2 Notification Families

#### Buying notifications
- saved listing sold
- saved listing deleted or archived
- saved listing price dropped
- seller replied in chat
- seller accepted or rejected a hold
- meetup confirmed, changed, or cancelled
- compare item became unavailable
- cart item became unavailable
- saved search matched a new listing

#### Selling notifications
- new message from buyer
- hold requested
- offer received or countered
- meetup requested or updated
- listing was saved by buyers
- listing was reported
- listing was moderated
- listing quality issue detected
- stale listing coaching prompt
- strong traction spike

#### Shared transaction notifications
- hold created
- hold expiring
- meetup scheduled
- meetup cancelled
- transaction marked complete
- listing status changed to sold, reserved, or unavailable

#### Safety and system notifications
- risky payment warning
- suspicious chat language detected
- policy reminder
- profile completeness or trust warning
- maintenance or degraded AI mode message

#### Admin and moderator notifications
- new severe report
- repeated reports on same listing or user
- high-risk chat cluster
- moderation backlog or unresolved queue growth

### 10.3 Inbox Structure

Recommended inbox segmentation:
- All
- Buying
- Selling
- Safety

Recommended sectioning inside each tab:
- Needs Action
- Recent Updates
- Earlier

### 10.4 Visual and Interaction Treatment

The system should use semantic accents rather than loud color blocks:
- Buying: soft blue
- Selling: warm gold
- Safety: muted coral/red
- System: neutral graphite
- Admin: strict dark accent where appropriate

Every meaningful notification should support direct action where applicable:
- Reply
- View Listing
- Open Chat
- Accept Hold
- Review Offer
- Compare Again
- Dismiss

### 10.5 Acceptance Criteria

- buyer, seller, safety, and system notifications are distinguishable at a glance
- notifications are grouped by meaning, not only chronology
- high-value notifications expose direct actions
- seller and buyer notifications do not feel like one mixed noisy feed

### 10.6 Test Cases

#### TC-NOTIF-001
Title: Buyer saved-item sold notification  
Steps:
1. Buyer saves a listing
2. Seller marks the listing sold
Expected:
- buyer receives a buying-context notification
- notification opens the relevant listing or fallback state

#### TC-NOTIF-002
Title: Seller lead-action notification  
Steps:
1. Buyer sends chat or hold request
2. Seller opens notifications
Expected:
- seller sees a selling-context actionable notification

#### TC-NOTIF-003
Title: Safety notification demarcation  
Steps:
1. Trigger a risky payment-language warning in chat
2. Inspect notification inbox
Expected:
- warning appears under Safety with distinct visual treatment

---

## 11. Listing Card, Context, Dashboard, and My Listings Quality Standard

### 11.1 Problem

Several core surfaces still feel underpowered even when the underlying data exists:
- listing cards are not elaborate or polished enough
- dashboard is useful but still weak as a daily command center
- context shifts between listing, seller, chat, meetups, and notifications are not always smooth
- My Listings needs to behave like a seller workspace, not just a tab with records

### 11.2 My Listings Expectations

My Listings should become a first-class seller control center with:
- active, reserved, sold, hidden, and archived states
- edit / delete / duplicate / relist
- mark sold or reserved
- visible created and last modified timestamps
- moderation state visibility
- item performance summary
- notification and buyer-interest context

### 11.3 Listing Card Standard

Listing cards should be upgraded to a more premium and trustworthy standard:
- richer media treatment
- consistent carousel or single-image state
- clearer pricing hierarchy
- seller and trust context
- concise but meaningful detail density
- stable CTA layout
- stronger polish and hierarchy across card types

### 11.4 Context Integrity

The product should preserve context across transitions:
- listing to seller
- listing to chat
- listing to meetup
- listing to notification
- listing to compare

Users should not feel like they are opening disconnected surfaces.

### 11.5 Dashboard Expectations

Dashboard should evolve into a useful summary and action center:
- active listings summary
- performance highlights
- saved searches and alerts
- notifications summary
- recent buyer/seller actions
- recommendation and coaching slots
- quick return to in-progress actions

### 11.6 Acceptance Criteria

- My Listings is clearly a seller workspace
- listing cards feel richer, more consistent, and more trustworthy
- dashboard provides real daily utility instead of acting as a thin link hub
- context survives route changes and user actions cleanly

### 11.7 Test Cases

#### TC-LISTING-UX-001
Title: My Listings seller control center  
Steps:
1. Open seller profile or account workspace
2. Inspect My Listings
Expected:
- seller can manage statuses and actions from one coherent workspace

#### TC-LISTING-UX-002
Title: Listing card consistency  
Steps:
1. Browse multiple card types
2. Compare media, metadata, and CTA layout
Expected:
- cards follow one consistent polished contract

#### TC-DASH-001
Title: Dashboard action utility  
Steps:
1. Open dashboard with listings, notifications, and saved objects present
Expected:
- dashboard surfaces meaningful action-oriented summaries instead of mostly navigational content

---

## 12. Formalized AI Feature Strategy for Freemium

### 12.1 Why This Section Exists

UniKart already contains AI hooks, but the AI layer must become a deliberate product system rather than a collection of partially visible helpers. This section formalizes the approved AI feature set, the freemium split, and the operational rules for how AI should behave.

### 12.2 Current Diagnosis

The current AI layer is likely underperforming because:
- provider failures can silently fall back to heuristic behavior
- the product does not always distinguish clearly between true model output and fallback output
- AI outputs are not yet consistently persisted as reusable artifacts
- observability around model failures, latency, and malformed responses is too weak

### 12.3 Approved Core AI Features

The following seven AI feature families are approved for UniKart:

1. Listing Assist
   - improve title
   - improve description clarity
   - suggest category
   - suggest tags
   - identify missing details

2. Price Guidance
   - suggest a realistic price band
   - flag likely underpricing or overpricing
   - offer “sell faster” recommendations

3. Search Rewrite
   - convert natural-language intent into better structured search/filter state
   - support category, mode, and value-intent inference

4. Chat Safety Layer
   - detect scam phrasing
   - detect off-platform payment pressure
   - flag risky negotiation language
   - suggest safer reply framing

5. Seller Coaching
   - listing quality nudges
   - trust-building suggestions
   - stale listing improvement suggestions
   - conversion-oriented guidance

6. Admin Report Summarization
   - summarize reports
   - identify likely policy issues
   - suggest moderation direction

7. Similarity and Compare Intelligence
   - explain meaningful listing differences
   - suggest better alternatives
   - support compare reasoning rather than pure side-by-side display

### 12.4 Freemium Packaging

#### Free tier
- basic listing assist
- basic search rewrite
- basic chat safety warning
- basic listing risk scan
- limited daily AI actions

#### Seller Pro tier
- stronger listing rewrite
- price guidance bands
- seller coaching
- duplicate or stale listing suggestions
- bundle and conversion suggestions
- higher AI usage quota

#### Admin / Operations tier
- report summarization
- moderation priority support
- repeated risk pattern clustering
- evidence stitching across listing, chat, and reports

### 12.5 Product Rules

- AI must remain assistive, not authoritative
- AI must not silently take destructive actions
- AI output should prefer structured, actionable suggestions over long generic prose
- fallback behavior must be observable internally
- when practical, valuable AI output should be persisted to `ai_artifacts`
- AI should not dominate core flows when inactive

### 12.6 Acceptance Criteria

- each approved AI feature has a clearly defined trigger, output shape, and UI surface
- free vs paid capability boundaries are explicit
- AI failures do not masquerade as high-confidence answers without observability
- AI remains optional and supportive in user-facing flows

### 12.7 Test Cases

#### TC-AI-001
Title: Listing assist availability by completeness  
Steps:
1. Open sell flow with empty listing
2. Attempt AI improve action
3. Add title, category, and price
4. Retry AI improve action
Expected:
- empty listing shows a compact unlock hint
- partially completed listing unlocks valid suggestions

#### TC-AI-002
Title: Free-tier AI quota behavior  
Steps:
1. Use AI actions repeatedly under a free-tier test account
Expected:
- free-tier limit is enforced clearly
- the user receives an informative quota message

#### TC-AI-003
Title: Compare intelligence explanation  
Steps:
1. Add two listings to compare
2. Trigger compare reasoning
Expected:
- system explains major differences in price, condition, and suitability
- explanation remains concise and actionable

---

## 8. Additional Backlog Themes to Brainstorm and Rank

Below are additional next-phase ideas that are meaningful, but should be ranked after the five priorities above.

### 8.1 Trust and Export
- downloadable listing packet PDF
- downloadable seller summary PDF
- moderation evidence packet PDF

### 8.2 Personalization
- buyer mode vs seller mode toggle
- account preferences
- notification preferences
- custom collections for saved listings

### 8.3 Listing Management
- duplicate listing
- archive listing
- bulk edit listings
- listing templates

### 8.4 Admin Operations
- stronger moderation queue sorting
- clustered reports
- repeat offender detection
- account-level moderation status

### 8.5 Multi-User QA Infrastructure
- seeded test users
- local role switcher
- environment reset helper
- demo dataset loader

### 8.6 Trust Docs and Evidence
- exportable policy summaries
- printable campus meetup guide
- item handoff checklist

---

## 9. Suggested Execution Order

Recommended next implementation order:

1. Admin privilege truth
2. Dual-user login/testing model
3. Maximum user control over saved filters/listings/notifications
4. Seller/listing PDF export
5. Navigation redundancy cleanup and final account IA tuning

Reason:
- admin and multi-user testing are foundational truth enablers
- once those are stable, the rest can be verified properly

---

## 10. Definition of Done for This Phase

This next phase should be considered complete only when:
- seller/listing PDF export works and is safe
- personal navigation is coherent
- user-owned objects are fully manageable
- admin actions have real consequences
- two-user testing can validate interactive flows reliably
- documentation exists for QA and acceptance

---

## 11. Repo-Root Verification Commands

Run from repo root:

```powershell
.\start-mvp.cmd
npm.cmd run build:backend
npm.cmd run build:frontend
```

When manual QA begins, verify at least:
- `/dashboard`
- `/marketplace`
- `/sell`
- `/profiles/<profileId>`
- `/compare`
- `/messages`
- `/moderation`
- `/cart`

---

## 12. Notes for Future UI Revamp

The UI may be reworked later for stronger consistency and delight. When that happens:
- preserve behavioral truth before aesthetic experimentation
- keep the account layer coherent
- keep export, admin, and multi-user test flows intact
- do not regress the listing studio quality bar
