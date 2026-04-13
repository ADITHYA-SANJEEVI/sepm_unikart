# UniKart Full Feature Inventory

This document is the exhaustive product, route, state, utility, and backend capability inventory for the current UniKart repository.
It is meant to be broader and more literal than a frontend plan.
It includes large features, medium workflows, tiny affordances, background state systems, exports, admin tools, safety features, and the small interaction systems that make the product behave like a real app.

Use this document when you need to answer:

- what exists right now
- what each thing does
- which page or endpoint owns it
- which utilities are visible versus hidden
- which systems are user-facing versus operator-only
- which pieces are active, partial, or legacy

This is an inventory document, not a design-quality judgment.

## Scope

Included:

- active frontend routes in `frontend-v2`
- active frontend shared systems
- backend HTTP endpoints
- backend service-level capability clusters
- user-facing features
- admin/operator-facing features
- AI features
- hidden state systems
- exports
- caching and persistence helpers
- mobile and shell behavior systems
- legacy or inactive frontend artifacts still present in the repo

Not included:

- every CSS class one by one
- every single data field from every TypeScript type
- generic framework plumbing with no feature meaning

## Product Summary

UniKart is a campus marketplace application with:

- buyer flows
- seller flows
- admin/moderation flows
- support and safety flows
- AI-assisted listing and moderation flows
- saved-state flows
- compare/cart/shortlist flows
- notification and messaging flows
- meetup/handoff coordination flows

The current active frontend is `frontend-v2`.

## 1. Active Frontend Route Inventory

### `/`

Purpose:

- lightweight home or entry surface for the new frontend

Contains:

- UniKart page header
- core product summary
- dashboard CTA
- browse CTA
- "why students use it" block
- "what stays close" block
- metric-style overview tiles

What it does:

- frames the product
- gives a soft entry into browse or dashboard
- provides a clean home route instead of dumping directly into a raw workflow

### `/auth`

Purpose:

- authentication and local test-session control

Contains:

- current session display
- magic-link sign-in form
- test account / persona picker
- manual test session editor
- admin access / override input
- clear session action

What it does:

- shows which account is currently active
- starts real sign-in
- supports dev and QA workflows with buyer/seller/admin personas
- exposes admin override handling

### `/dashboard`

Purpose:

- role-aware control center for the current session

Contains:

- guest dashboard variant
- buyer dashboard variant
- seller dashboard variant
- admin dashboard variant
- overview hero
- hero metrics
- needs-attention bucket
- activity lanes
- workspace bucket
- personal tools
- analytics snapshot
- profile and trust block
- saved-searches block
- recently-viewed block

What it does:

- aggregates summary state from notifications, listings, favorites, compare, schedules, conversations, and admin analytics
- gives high-level “what should I do next” context

### `/marketplace`

Purpose:

- primary browse, discovery, search, filter, save, and shortlist surface

Contains:

- page intro
- saved shortcut
- create listing shortcut
- large search box
- search suggestions
- saved-search suggestions
- discovery buckets
- cart/compare/saved metric tiles
- compare tray
- filter rail
- results grid
- saved-search management block

What it does:

- supports both discovery mode and results mode
- opens filters when search intent is active
- lets users search, filter, compare, favorite, and add to cart directly from results

### `/listings/[listingId]`

Purpose:

- listing decision surface

Contains:

- listing hero
- category/state/trust pills
- media gallery
- image and video support
- price/status summary
- add-to-cart
- save/favorite
- compare toggle
- message seller
- hold request
- PDF export
- seller context
- decision snapshot
- description/details
- similar listings

What it does:

- lets the user evaluate a listing in detail
- supports moving into chat, compare, cart, hold, and PDF export

### `/compare`

Purpose:

- shortlist comparison workspace

Contains:

- compare summary header
- shortlist metrics
- unavailable-item warning block
- compare cards
- open listing CTA
- add to cart CTA
- remove-from-compare action
- clear compare action

What it does:

- compares selected listings side by side
- handles missing or unavailable compare items
- connects compare to listing detail and cart

### `/cart`

Purpose:

- grouped checkout simulation and settlement review

Contains:

- grouped cart by seller
- quantity stepper
- remove action
- clear cart action
- run checkout simulation
- totals
- seller settlements
- listing thumbnails
- open listing links

What it does:

- provides a pre-settlement workspace
- groups items by seller
- shows checkout simulation output from backend

### `/favorites`

Purpose:

- saved listings workspace

Contains:

- saved listing cards
- browse-more CTA
- clear saved action
- saved/compare/cart metrics
- compare integration
- cart integration
- saved-list controls block

What it does:

- holds and manages favorited listings
- lets users move from saved to compare or cart

### `/messages`

Purpose:

- listing-linked messaging workspace

Contains:

- thread list
- thread stats
- active thread area
- listing thumbnail
- listing price pill
- participant identity
- conversation bubble stack
- message composer
- moderation warning area
- offers panel
- offer composer
- meetup panel

What it does:

- anchors messaging to a listing
- supports message send
- supports moderated/sanitized chat
- supports offer creation and offer status handling
- shows meetups connected to the same listing

### `/notifications`

Purpose:

- full inbox for grouped alerts

Contains:

- lane switcher
- buying lane
- selling lane
- safety lane
- system lane
- admin lane
- sections for needs action, recent, earlier
- per-item open CTA
- mark-read CTA
- dismiss CTA
- notification preference toggles
- mark-all-read action

What it does:

- lets the user process updates
- keeps notifications grouped by lane and recency/urgency

### `/profiles/[profileId]`

Purpose:

- profile and listing workspace

Contains:

- public seller profile mode
- own profile mode
- profile header
- trust snapshot
- profile studio edit form
- PDF export
- my listings block
- listing state tabs
- preferences block
- seller analytics block
- recently viewed block
- blocked users block
- quick links

What it does:

- displays public trust information
- lets the owner edit their profile
- lets the owner manage listings from the same surface

### `/schedules`

Purpose:

- meetup planning and status tracking

Contains:

- meetup statistics
- create meetup form
- listing selector
- mode selector
- proposed time input
- notes input
- upcoming coordination list
- listing link
- accept action
- complete action

What it does:

- creates and updates meetups / schedules
- keeps meetup planning tied to listings

### `/sell`

Purpose:

- listing composition studio

Contains:

- sell page intro
- listing form
- preview
- readiness block
- metrics
- AI suggestion area
- publish action
- improve-with-AI action
- moderation/readiness guidance

What it does:

- creates or prepares listings for publication
- provides preview and quality guidance

### `/support`

Purpose:

- support and escalation surface

Contains:

- blocked user stats
- safety article count
- escalation-path metric
- “what to do first” guidance
- quick routes back to policy/messages/notifications/browse
- blocked users block
- support library block
- support packet export

What it does:

- gives support and safety entry points
- links users back into contextual routes

### `/policy`

Purpose:

- safety guidance and policy library surface

Contains:

- safety guide download
- before-you-meet checklist
- quick routes
- policy library
- FAQ block

What it does:

- surfaces safety rules and policy articles
- provides PDF export of the safety guide

### `/moderation`

Purpose:

- admin/operator moderation workspace

Contains:

- open report metrics
- high severity metrics
- action metrics
- hidden/suspended metrics
- action desk
- AI visibility
- open reports queue
- platform context
- moderation history
- recent provider events

What it does:

- supports operator review and enforcement
- links moderation to listing and report evidence

### `/platform-analytics`

Purpose:

- separate admin-only platform analytics surface

Contains:

- profiles count
- active listing count
- favorites count
- report count
- high-trust or strong listings
- most-saved style slices
- broader marketplace context

What it does:

- gives marketplace-wide operator visibility
- separates platform analytics from normal dashboard

### `/ai-lab`

Purpose:

- admin AI diagnostics and tooling page

Contains:

- AI event counts
- fallback counts
- timeout counts
- listing-assist tester
- chat-moderation tester
- admin report-summary tester
- provider health
- operator visibility section
- recent provider events
- AI artifacts

What it does:

- exercises AI endpoints
- shows AI diagnostics
- supports AI troubleshooting and evaluation

## 2. Global Shell Features

### Header features

- sticky header
- home logo link
- primary nav links
- admin nav item for admins
- cart icon
- notifications bell icon
- unread badge
- cart badge
- account pill
- active-role pill
- offline health pill

### Bell dropdown features

- notification summary panel
- view-all notifications CTA
- category lane cards
- preview of latest notifications
- per-item route resolution
- empty bell state

### Account dropdown features

- user identity block
- role/status pills
- workspace section
- account section
- admin section for admin users
- test-persona section
- session section
- internal scroll region

### Mobile drawer features

- open/close drawer
- primary links
- workspace links
- profile link
- cart link
- notifications link
- favorites link
- compare link
- meetups link

### Footer features

- UniKart brand line
- support link
- policy link
- notifications link
- authentication link
- trust/support footer presence

## 3. Shared Frontend Systems

### App provider features

- auth state storage
- compare state storage
- notifications storage
- notification inbox storage
- cart storage
- health polling / health check
- current profile fetch
- compare queue refresh
- compare queue sync
- compare queue clear
- compare queue optimistic-ish toggle behavior
- cart refresh
- notifications refresh
- sign in with magic link
- sign out
- set dev persona

### Client persistence features

- localStorage for auth-like local fields
- localStorage for compare IDs
- localStorage for notifications
- localStorage for notification inbox
- localStorage for cart

### API helper features

- proxied backend requests
- cache map for GET responses
- cache TTL support
- cache invalidation after mutations
- file download helper
- currency formatter

### Shared primitive features

- generic buttons
- generic icon buttons
- heart icon with filled state
- cart icon
- bell icon
- compare icon
- search icon
- menu icon
- close icon
- status pills
- surfaces
- metric tiles
- inline list helper
- checklist helper
- page header helper
- empty block helper

## 4. Identity, Auth, and Session Features

### Real auth-related features

- `/auth/me`
- magic-link sign-in flow
- auth session listener via Supabase browser client
- sign out via Supabase client

### Dev and QA auth features

- debug-bypass status fetch
- local persona switching
- stored dev email
- stored dev role
- stored dev full name
- manual admin override secret

### Session visibility features

- current session summary on auth page
- clear session action
- role pill in shell
- verified pill in dropdown/profile

## 5. Buyer Features

- browse listings
- search listings
- filter listings
- sort listings
- save listings
- unsave listings
- open saved listings page
- compare listings
- open compare page
- clear compare queue
- add to cart
- open cart
- update cart quantities
- clear cart
- run checkout simulation
- message seller
- create offers
- review offers
- schedule meetup
- view notifications
- manage notification preferences
- read policies
- download listing PDF
- download profile PDF
- see similar listings
- see seller profile
- see recently viewed listings
- save and manage saved filters
- toggle saved-search alerts

## 6. Seller Features

- create listing
- edit profile details
- see seller analytics
- see listing traction
- open own profile workspace
- see listing state tabs
- mark listing sold
- relist listing
- duplicate listing
- archive listing
- delete listing
- receive buyer chats
- receive offers
- accept or reject offers
- receive hold requests
- receive and coordinate meetups
- export seller profile PDF

## 7. Admin / Operator Features

- open moderation route
- open platform analytics route
- open AI lab route
- list reports
- list moderation actions
- read admin analytics
- read platform analytics
- inspect AI diagnostics
- inspect AI provider events
- inspect AI artifacts
- export report PDF
- apply moderation actions to reports
- inspect listing from report

## 8. Listing Domain Features

### Listing core data features

- title
- description
- category
- condition
- mode
- price
- area
- tags
- inventory count
- trust score
- status
- seller info
- media assets

### Listing lifecycle features

- create
- update
- archive
- mark sold
- relist
- duplicate
- delete
- favorite
- unfavorite
- report
- export PDF

### Listing relationship features

- fetch seller profile for listing
- fetch similar listings
- fetch offers for listing
- create offers on listing
- fetch holds for listing
- create holds for listing

## 9. Saved Search Features

- create saved filter
- read saved filters
- rename saved filter
- edit saved filter payload
- toggle alert enabled
- delete one saved filter
- clear all saved filters
- apply saved filter back into browse state
- suggest saved filters in search dropdown
- surface saved filters on dashboard
- surface saved filters in marketplace

What a saved filter holds:

- label
- filter payload
- alert enabled state
- last triggered time when available

## 10. Compare Features

- compare queue in header/profile/browse
- compare queue in local state
- compare queue in backend
- compare add
- compare remove
- compare replace
- compare clear
- compare count
- compare tray
- compare page
- unavailable compare cleanup
- compare to cart handoff

What compare holds:

- up to three listing IDs
- listing snapshots when fetched
- compare metrics such as trust, condition, price, area, mode, seller

## 11. Favorites / Saved Listing Features

- favorite toggle on cards
- favorite toggle on detail
- favorites fetch
- favorites page
- clear saved listings
- add saved listing to cart
- add saved listing to compare
- shortlist value summary

What favorites hold:

- saved listing membership for the current user
- listing snapshots when favorites are fetched

## 12. Cart Features

- cart fetch
- add item
- remove item
- update quantity
- clear cart
- checkout simulation
- seller grouping
- total item count
- total amount
- seller settlement summary
- cart badge
- cart page

What cart holds:

- cart items
- quantity per item
- listing linkage
- seller grouping
- total amount

## 13. Checkout Simulation Features

- backend simulation endpoint
- frontend "Run checkout" action
- seller settlement rows
- total item count
- estimated total amount
- seller group count

What it does not do:

- real payment collection
- real order placement
- real payment gateway integration

## 14. Messaging Features

### Thread features

- thread list
- unread count per thread
- last-message preview
- participant identity
- listing identity
- thread timestamps

### Message features

- fetch messages by listing
- send message
- display message bubbles
- show sender identity
- show timestamps
- show risk flags

### Moderation/safety messaging features

- frontend sanitization of phone numbers
- frontend sanitization of emails
- frontend sanitization of off-app contact words
- AI moderation call before send
- high-risk blocking on frontend if moderation says high
- warning rendering for moderated messages

### Thread context features

- listing thumbnail in thread
- open listing
- open seller profile
- listing price pill
- listing status pill

## 15. Offer Features

- fetch offers for listing
- create offer
- create counter-offer note
- accept offer
- reject offer
- pending-offer count
- styled offer cards in thread

What an offer holds:

- amount
- note
- actor
- kind
- status
- listing linkage

## 16. Hold Features

- list holds for listing
- create hold request
- update hold status
- reflect hold state back into listing flows

What a hold holds:

- hold duration or type
- status
- listing linkage
- involved parties

## 17. Meetup / Schedule Features

- list schedules
- create schedule
- update schedule status
- requested mode
- proposed time
- notes
- listing linkage
- meetup stats
- accept and complete actions

What a schedule holds:

- listing ID
- requested mode
- proposed time
- notes
- status
- participants

## 18. Notifications Features

### Notification objects

- title
- body
- lane
- action label
- action href
- entity type
- entity ID
- read state
- created/updated timestamps

### Notification flows

- fetch all notifications
- fetch grouped inbox
- alternate fetch path compatibility (`/notification-inbox`)
- mark one read
- mark all read
- dismiss one
- preview latest notifications in bell dropdown
- open routed destination from notification

### Notification preference features

- fetch preferences
- patch preferences
- buying toggle
- selling toggle
- safety toggle
- system toggle
- saved search alerts toggle

## 19. Recently Viewed Features

- record listing as recently viewed
- list recently viewed listings
- surface recently viewed on dashboard
- surface recently viewed on profile
- use recently viewed as quick-return utility

## 20. Block / Safety Features

- block user
- list blocked users
- blocked users visible in profile
- blocked users visible in support
- support packet export
- safety guide export
- policy article listing
- FAQ content

## 21. Profile Features

### Profile data features

- full name
- bio
- contact note field
- hostel
- department
- seller headline
- preferred meetup spot
- favorite categories
- verification state
- profile completeness
- response reliability
- campus ID

### Profile management features

- fetch profile by ID
- patch own profile
- patch profile-by-ID with auth
- export profile PDF
- view seller profile
- view own profile

## 22. Media Features

- create media upload ticket
- patch/finalize media asset
- list media assets for listing
- delete media asset
- render media in cards
- render media in listing detail
- render media thumbnails in cart/messages

Types of media behavior present:

- image rendering
- video rendering
- fallback state when media missing

## 23. AI Features

### Listing AI

- `/ai/listing-assist`
- used to improve listing structure and quality suggestions

### Listing moderation AI

- `/ai/moderate/listing`
- evaluates listing safety/quality/moderation concerns

### Chat moderation AI

- `/ai/moderate/chat`
- evaluates risky messages before send

### Report summary AI

- `/ai/admin/report-summary/:reportId`
- generates structured summary for moderation report

### Search assist AI

- `/ai/search-assist`
- supports smarter discovery / search guidance

### AI operator visibility

- AI diagnostics
- provider events
- artifacts
- fallback counts
- timeout counts

## 24. Dashboard Backend Features

### Summary

- unread notification count
- active listings
- reserved listings
- sold listings
- favorite count
- compare queue count
- conversation count
- schedule count
- saved filters
- recently viewed
- notification summary objects

### User analytics

- buyer analytics
- seller analytics
- daily trend data
- saved listings counts
- compared listing counts
- conversations
- filters/alerts
- holds
- schedules

### Admin analytics

- open reports
- high severity reports
- moderation actions
- hidden or suspended listings
- trend slices

### Platform analytics

- total profiles
- active listings
- total saved filters
- total compare queue items
- total AI artifacts
- unread notifications
- daily activity
- feature usage counts

## 25. Backend Endpoint Inventory With Brief Descriptions

### Health

- `GET /health`
  - returns backend health and auth-mode information

### Auth

- `GET /auth/me`
  - returns current user and profile context
- `GET /auth/debug-bypass-status`
  - returns debug/dev bypass availability and personas
- `PATCH /auth/profile`
  - updates auth-linked profile
- `POST /auth/profile`
  - alternate create/update path for auth-linked profile

### AI

- `POST /ai/listing-assist`
  - returns AI guidance for listing quality/composition
- `POST /ai/moderate/listing`
  - returns moderation/safety assessment for listing content
- `POST /ai/moderate/chat`
  - returns moderation/risk assessment for chat message content
- `GET /ai/admin/report-summary/:reportId`
  - returns AI-generated summary for admin report
- `POST /ai/search-assist`
  - returns AI help for search/discovery prompts

### Admin

- `GET /admin/reports`
  - lists reports for moderation
- `GET /admin/moderation-actions`
  - lists applied moderation actions
- `GET /admin/analytics`
  - returns moderation/admin metrics
- `GET /admin/platform-analytics`
  - returns platform-wide metrics
- `GET /admin/ai-artifacts`
  - returns stored AI artifacts
- `GET /admin/ai-provider-events`
  - returns provider event logs
- `GET /admin/ai-diagnostics`
  - returns AI diagnostic summary
- `GET /admin/reports/:reportId/export-pdf`
  - exports report evidence to PDF
- `POST /admin/reports/:reportId/actions`
  - applies moderation action to a report

### Dashboard

- `GET /dashboard/summary`
  - returns dashboard summary object for the current user
- `GET /dashboard/analytics`
  - returns buyer/seller analytics for current user
- `GET /dashboard/platform-analytics`
  - returns platform analytics summary for dashboard usage

### Listings

- `GET /listings`
  - lists listings with filtering/sorting
- `GET /listings/compare`
  - fetches listings for compare queue or explicit IDs
- `GET /listings/mine`
  - lists current user’s own listings
- `GET /listings/favorites`
  - lists favorited listings for current user
- `GET /listings/:listingId`
  - fetches single listing detail
- `GET /listings/:listingId/similar`
  - fetches similar listings
- `GET /listings/:listingId/seller`
  - fetches seller profile/context for listing
- `GET /listings/:listingId/export-pdf`
  - exports listing PDF
- `POST /listings`
  - creates listing
- `PATCH /listings/:listingId`
  - updates listing
- `POST /listings/:listingId/archive`
  - archives listing
- `POST /listings/:listingId/mark-sold`
  - marks listing sold
- `POST /listings/:listingId/relist`
  - relists sold/archived listing
- `POST /listings/:listingId/duplicate`
  - duplicates listing
- `GET /listings/:listingId/offers`
  - lists offers for listing
- `POST /listings/:listingId/offers`
  - creates offer for listing
- `PATCH /listings/offers/:offerId`
  - updates offer status
- `GET /listings/:listingId/holds`
  - lists holds for listing
- `POST /listings/:listingId/holds`
  - creates hold for listing
- `PATCH /listings/holds/:holdId`
  - updates hold status
- `DELETE /listings/:listingId`
  - deletes listing
- `POST /listings/:listingId/favorite`
  - favorites listing
- `DELETE /listings/:listingId/favorite`
  - removes favorite
- `POST /listings/:listingId/report`
  - reports listing

### Media

- `POST /media/upload-ticket`
  - creates upload ticket for media asset
- `PATCH /media/assets/:assetId`
  - finalizes or updates media asset
- `GET /media/listing/:listingId`
  - lists media for listing
- `DELETE /media/assets/:assetId`
  - deletes media asset

### Cart

- `GET /cart`
  - returns cart view
- `POST /cart/items`
  - adds item to cart
- `DELETE /cart/items/:cartItemId`
  - removes item
- `PATCH /cart/items/:cartItemId`
  - updates quantity
- `DELETE /cart`
  - clears cart
- `POST /cart/checkout-simulate`
  - returns grouped checkout simulation

### Chat

- `GET /chat`
  - lists conversations
- `GET /chat/:listingId/messages`
  - lists messages for listing-linked thread
- `POST /chat/:listingId/messages`
  - creates message in thread

### Profiles

- `GET /profiles/me`
  - fetches current user profile
- `PATCH /profiles/me`
  - updates current user profile
- `GET /profiles/:profileId`
  - fetches public profile by ID
- `PATCH /profiles/:profileId`
  - updates profile by ID with auth
- `GET /profiles/:profileId/listings`
  - lists listings owned by profile
- `GET /profiles/:profileId/export-pdf`
  - exports profile PDF

### Schedules

- `GET /schedules`
  - lists schedules/meetups for current user
- `POST /schedules`
  - creates schedule/meetup
- `PATCH /schedules/:scheduleId`
  - updates schedule status

### Policies

- `GET /policies`
  - lists policy articles
- `GET /policies/export-pdf`
  - exports safety/policy PDF

### Users

- `GET /users/setup-profile`
  - fetches setup-profile context
- `POST /users/setup-profile`
  - submits setup-profile data
- `GET /users/blocked`
  - lists blocked users
- `GET /users/support/export-pdf`
  - exports support packet
- `POST /users/block`
  - blocks a user
- `GET /users/saved-filters`
  - lists saved filters
- `POST /users/saved-filters`
  - creates saved filter
- `PATCH /users/saved-filters/:filterId`
  - updates saved filter
- `DELETE /users/saved-filters/:filterId`
  - deletes saved filter
- `DELETE /users/saved-filters`
  - clears all saved filters
- `GET /users/compare-queue`
  - lists compare queue items
- `PUT /users/compare-queue`
  - replaces compare queue
- `POST /users/compare-queue/:listingId`
  - adds item to compare queue
- `DELETE /users/compare-queue/:listingId`
  - removes item from compare queue
- `DELETE /users/compare-queue`
  - clears compare queue
- `GET /users/notification-preferences`
  - reads notification preferences
- `PATCH /users/notification-preferences`
  - updates notification preferences
- `GET /users/recently-viewed`
  - lists recently viewed items
- `POST /users/recently-viewed`
  - records recently viewed listing
- `GET /users/notifications`
  - lists raw notifications
- `GET /users/notifications/inbox`
  - lists grouped notification inbox
- `GET /users/notification-inbox`
  - alternate grouped inbox route
- `PATCH /users/notifications/read-all`
  - marks all notifications read
- `PATCH /users/notifications/:notificationId/read`
  - marks one notification read
- `DELETE /users/notifications/:notificationId`
  - dismisses or deletes notification

## 26. Hidden or Background Product Systems

These are not always obvious on screen, but they are product features because they materially affect behavior.

### Caching systems

- in-memory GET response cache
- cache TTL per request
- cart cache reuse
- notification cache reuse
- compare queue reuse

### Persistence systems

- auth-like dev session persistence
- compare queue persistence
- cart persistence
- notification persistence

### Sync systems

- cart refresh after mutation
- compare refresh after mutation
- notifications refresh after mutation
- profile refresh after mutation
- sell/detail refresh after state changes like holds

### Export systems

- listing PDF export
- profile PDF export
- support packet export
- safety guide export
- moderation report export

### Role-awareness systems

- buyer route behavior
- seller route behavior
- admin route behavior
- admin-only nav and route surfaces

### Safety systems

- AI chat moderation call
- frontend message redaction
- support escalation routes
- policy library
- blocked users
- listing reports
- moderation actions

## 27. Small UX / Micro-Feature Inventory

- unread badges
- cart count badge
- compare count in profile dropdown
- compare count in marketplace metrics
- notification count in profile dropdown
- subtle active nav state
- mobile close button in drawer
- empty states with CTA
- loading states
- skeleton cards
- disabled button states
- inventory-aware quantity disable
- thumbnail click-through in cart
- thumbnail click-through in messages
- listing links inside schedule rows
- “view all notifications” CTA in bell panel
- lane pill tones
- role/status pills
- verified pill
- account dropdown internal scroll
- bell dropdown internal scroll
- filter panel internal scroll
- recently viewed quick-return behavior
- fallback compare fetch behavior
- auto-focus reset behavior in browse
- saved-search suggestion reuse in search
- warning timeout clearing
- message timeout clearing
- local state cleanup on sign out

## 28. Legacy / Inactive / Reference Artifacts Still Present

These are in the repo but are not the main active route implementation path.

- `frontend-v2/components/app-shell.js`
  - older shell implementation/reference artifact
- `frontend-v2/components/listing-card.js`
  - older or alternate card implementation artifact
- `frontend-v2/components/dashboard/dashboard-preview.js`
  - preview or mock dashboard artifact
- `frontend-v2/components/layout/route-placeholder.js`
  - placeholder route artifact
- `frontend-v2/components/v2-primitives.js`
  - wrapper or alias primitive layer

These matter because:

- they can confuse future audits
- they may still contain stale copy or styling ideas
- they are not the primary active route components

## 29. Entity Inventory

Core domain entities represented in the app:

- health payload
- auth user
- profile
- listing
- listing media asset
- favorite relationship
- saved filter
- compare queue item
- cart
- cart item
- conversation
- message
- negotiation offer
- listing hold
- schedule / meetup
- user notification
- notification inbox
- notification preference
- recently viewed item
- blocked user relationship
- report
- moderation action
- policy article
- AI artifact
- AI provider event
- dashboard summary
- user analytics summary
- admin analytics summary
- platform analytics summary

## 30. Tiny But Real Inventory Items People Often Miss

These are small enough to be forgotten in planning, but they are real features or real product responsibilities.

### Header and shell micro-features

- cart icon click target
- bell icon click target
- account pill click target
- nav active-state styling
- mobile drawer close action
- dropdown outside-click close behavior
- bell outside-click close behavior
- offline health pill visibility
- role pill visibility
- admin nav conditional visibility

### Dropdown micro-features

- lane cards inside bell
- latest-notification preview rows
- bell “view all” CTA
- workspace section labels in account dropdown
- account section labels in account dropdown
- admin section labels in account dropdown
- test-persona buttons in dropdown
- session controls in dropdown
- internal dropdown scroll container

### Card micro-features

- filled heart icon state
- compare-button active state
- cart busy state
- favorite busy state
- media fallback text
- price formatting
- trust pill formatting
- seller snippet formatting

### Form micro-features

- field labels
- focused field border and ring
- select styling
- textarea styling
- disabled button state
- numeric quantity button disable at stock cap

### Feedback micro-features

- ephemeral message banners via local state
- warning message timeout
- success message timeout
- loading copy
- no-results empty state
- no-notifications empty state
- no-blocked-users empty state
- no-saved-filters empty state
- no-compare-items empty state
- no-cart-items empty state

### Linkage micro-features

- open listing from compare
- open listing from cart
- open listing from messages
- open listing from schedules
- open seller from messages
- quick links from profile
- quick links from support
- quick links from policy
- bell item route resolution
- notifications item route resolution

### Safety micro-features

- phone-number redaction in outgoing chat
- email redaction in outgoing chat
- off-app handle word redaction in outgoing chat
- sanitized render of risky text
- moderation warning display
- high-risk chat-send block
- blocked-user visibility

## 31. Frontend Components By Feature Ownership

### Shell / app-level

- `frontend-v2/components/v2-shell.js`
  - active shell, header, bell, account dropdown, mobile drawer, footer
- `frontend-v2/components/v2-app-providers.js`
  - app-wide auth, compare, cart, notification, caching, persistence, and session helpers
- `frontend-v2/components/system/primitives.js`
  - buttons, icons, surfaces, metric tiles, pills, page headers, empty blocks

### Page-level route components

- `frontend-v2/components/layout/home-preview.js`
  - home route surface
- `frontend-v2/components/dashboard/dashboard-page.js`
  - dashboard surface
- `frontend-v2/components/marketplace/marketplace-page.js`
  - browse/search/filter/saved-search surface
- `frontend-v2/components/marketplace/v2-listing-card.js`
  - active listing-card system
- `frontend-v2/components/listing/v2-listing-detail-page.js`
  - listing detail surface
- `frontend-v2/components/compare/v2-compare-page.js`
  - compare surface
- `frontend-v2/components/cart/v2-cart-page.js`
  - cart and checkout simulation surface
- `frontend-v2/components/workspace/v2-favorites-page.js`
  - saved listings surface
- `frontend-v2/components/workspace/v2-messages-page.js`
  - chat/offer/meetup surface
- `frontend-v2/components/workspace/v2-notifications-page.js`
  - notification inbox surface
- `frontend-v2/components/workspace/v2-profile-page.js`
  - public and own profile surface
- `frontend-v2/components/workspace/v2-schedules-page.js`
  - meetup scheduling surface
- `frontend-v2/components/workspace/v2-auth-page.js`
  - auth/test persona surface
- `frontend-v2/components/studio/v2-sell-page.js`
  - sell studio
- `frontend-v2/components/admin/v2-support-page.js`
  - support surface
- `frontend-v2/components/admin/v2-policy-page.js`
  - safety/policy surface
- `frontend-v2/components/admin/v2-moderation-page.js`
  - moderation/admin workspace
- `frontend-v2/components/admin/v2-platform-analytics-page.js`
  - platform analytics surface
- `frontend-v2/components/admin/v2-ai-lab-page.js`
  - AI diagnostics and tooling surface

## 32. Backend Service Capability Clusters

The route list above is the HTTP layer.
Under that, the backend service layer currently supports these major capability clusters:

- own-profile fetch and update
- policy listing
- saved-filter CRUD
- compare queue CRUD
- media upload-ticket and lifecycle handling
- recently-viewed record/list
- notifications list/read/dismiss
- dashboard summary build
- user analytics build
- admin analytics build
- platform analytics build
- listing list/detail/seller/similar
- own listing list
- listing create/update/mark-sold/archive/relist/duplicate/delete
- favorite listings list and favorite membership handling
- cart list/add/update/remove/clear/simulate
- conversation listing
- message listing and creation
- offer list/create/update
- hold list/create/update
- compare listing resolution
- schedule list/create/update
- block list
- report list/get
- moderation action add/list

## 33. Short “What Exists” Summary

If you need the blunt answer, UniKart currently includes:

- a rebuilt `frontend-v2` app
- buyer flows
- seller flows
- admin flows
- saved searches
- saved listings
- compare
- cart
- grouped checkout simulation
- listing detail
- listing CRUD
- seller profile/workspace
- listing PDF export
- profile PDF export
- support packet export
- safety guide export
- chat
- offers
- holds
- meetups
- notifications
- notification preferences
- recently viewed
- blocked users
- support and safety pages
- moderation
- platform analytics
- AI diagnostics
- AI listing assist
- AI listing moderation
- AI chat moderation
- AI report summaries
- media upload-ticket/finalize/list/delete
- dev/test persona auth flows
- role-aware dashboard
- shell-level cart/bell/account systems

## 34. Recommended Use Of This Document

Best uses:

- paste into ChatGPT or another planner and ask for redesign or re-architecture help
- use as a checklist to ensure no surface is forgotten
- use as a backend/frontend contract map
- use as the source for "what still needs polish" conversations

Worst uses:

- assuming every item here is perfectly finished
- assuming every item here is perfectly designed
- assuming every endpoint has equal production quality
This document says what exists and what the product encompasses.
It does not claim that every item is fully polished.
