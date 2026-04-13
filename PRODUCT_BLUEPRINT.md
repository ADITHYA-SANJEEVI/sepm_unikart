# UniKart Product Blueprint

## 1. Product Vision

**UniKart** is a trusted campus-first secondhand marketplace built for students of **SRM KTR** to buy, sell, discover, and safely exchange used items within a verified college community.

The platform is designed to feel more trustworthy and structured than WhatsApp groups or Instagram resale pages, while being easier and safer for students than generic open marketplaces.

For implementation purposes, Supabase modifications are explicitly allowed through the configured MCP server wherever necessary. This includes schema evolution, migrations, secure views, storage setup, analytics models, and other database-side changes needed to deliver the intended product behavior.

### Core positioning
- Campus-specific resale marketplace
- Built around trust, safety, and delight
- Local transactions with delivery/pickup coordination
- Structured listings and powerful product discovery
- AI-assisted, but never AI-dominated, buyer and seller workflows
- Premium, high-energy consumer experience inspired by the breadth of Amazon and the playful locality of Swiggy
- Scale-ready foundation for expansion to other campuses

---

## 2. Initial Launch Scope

### Launch market
- **SRM KTR campus only**

### Expansion readiness
The architecture, data model, and product decisions should still assume future scaling to:
- additional SRM campuses
- multiple universities
- multiple city clusters
- campus-specific moderation and logistics rules

---

## 3. Core MVP Scope

The MVP should be polished, focused, and execution-ready.

### Primary marketplace capabilities
- Browse listings
- Buy listings
- Sell listings
- Listing cards in feed/grid format
- Listing detail pages opening from cards
- Seller profile preview
- Chat with seller
- Delivery scheduling / meetup scheduling
- Razorpay integration
- Favorites / saved listings
- Saved search alerts
- Notifications segmented by buyer, seller, and safety context
- Report listing / report user
- Mark listings as reserved / sold

### Trust and operational capabilities
- Campus-focused identity model
- Secure user auth through Supabase Auth later
- Development auth bypass initially
- Strong privacy defaults
- Safety tooling for both buyers and sellers
- Admin review/moderation
- Anti-scam and anti-abuse guardrails
- AI assist layers for listing quality, discovery, safety, and moderation
- aggressive caching and prefetch for high-probability read flows
- analytics across seller, buyer, moderator, and platform layers

---

## 4. Primary User Types

### Buyers
Students who want affordable goods such as:
- books
- calculators
- electronics
- furniture
- hostel essentials
- fashion
- cycles
- room appliances
- lab / academic equipment

### Sellers
Students who want to:
- declutter
- liquidate items quickly
- earn from used goods
- sell to trusted local peers
- avoid unreliable public marketplaces

### Admins / Moderators
Platform managers who:
- handle reports
- review risky accounts
- remove prohibited items
- moderate fraud/spam
- manage categories, rules, and eventually campuses

---

## 5. Product Pillars

### 5.1 Trust
The platform must feel safe enough that a student would actually prefer using it over informal channels.

### 5.2 Premium convenience
The product should feel effortless, fast, and deeply useful, with the confidence and breadth users associate with Amazon.

### 5.3 Safety
Safety is not a side feature. It is one of the main product pillars.

### 5.4 Local delight
The platform should feel alive, expressive, and campus-native, with the playful, high-energy locality that makes Swiggy-like products engaging.

### 5.5 Discovery and versatility
The experience should support many item types, use cases, and user intents without feeling cluttered.

### 5.6 Scale readiness
Even if launch is single-campus, the product and schema should not corner itself architecturally.

### 5.7 Assistive intelligence
AI should act as a structured co-pilot for buyers, sellers, and admins:
- improve quality and trust
- speed up discovery and decision making
- reduce unsafe behavior
- support moderation

AI must remain assistive rather than authoritative, and should never overpower the manual marketplace workflow.

### 5.8 Performance and responsiveness
The product must feel fast on repeat usage:
- warmed discovery
- short-lived cache reuse
- strategic prefetch of likely next reads
- request deduplication
- bounded memory use

Performance work must reduce latency without creating stale-truth bugs.

### 5.9 Analytics and observability
UniKart should provide useful operational visibility to:
- sellers
- buyers
- moderators/admins
- the platform team

Analytics must support both product decision-making and trust-and-safety operations.

---

## 6. MVP User Flows

## 6.1 Seller flow
1. User signs in or uses dev bypass mode
2. User creates a listing
3. User uploads item images
4. User enters title, category, description, condition, price
5. User adds delivery / meetup options
6. User publishes listing
7. Buyers discover and open listing card
8. Buyers chat with seller
9. Seller negotiates
10. Delivery or meetup gets scheduled
11. Payment may occur through Razorpay or offline depending on transaction mode
12. Listing is marked reserved or sold

## 6.2 Buyer flow
1. User browses listings
2. User filters and searches
3. User opens a listing from card view
4. User reviews item details, images, price, seller trust signals
5. User chats with seller
6. User schedules delivery / pickup / meetup
7. User pays via Razorpay or arranged method
8. User receives item
9. User reports issues if needed

## 6.3 Admin flow
1. Admin reviews reports
2. Admin checks risky listings/users
3. Admin removes harmful content
4. Admin intervenes in fraudulent or abusive cases
5. Admin monitors category quality, safety trends, and campus health

---

## 7. Experience Direction: “Amazon × Swiggy for Campus”

This product should not feel like a basic classifieds board. It should feel like a **premium campus commerce platform**.

### 7.1 What “Amazon” means in this context
Adopt the strongest product traits from Amazon:
- wide versatility across categories and buyer intents
- structured discovery and filtering
- confidence-building product information
- strong listing detail presentation
- smooth browsing-to-decision experience
- high utility and strong information density where it helps conversion

### 7.2 What “Swiggy” means in this context
Adopt the strongest product traits from Swiggy:
- hyper-local feel
- visually expressive and playful UI moments
- energy, momentum, and excitement in the browsing experience
- local fulfillment thinking
- highly visible actions and status states
- delightful motion, microcopy, and contextual nudges

### 7.3 Resulting product character
UniKart should feel:
- premium
- energetic
- youthful
- visually rich
- conversion-focused
- local-first
- category-deep
- safe and trustworthy

### 7.4 UX principles derived from this direction
- rich cards, not dead cards
- fast actions from list views
- strong imagery everywhere
- powerful filters without visual heaviness
- clear pricing and condition hierarchy
- highly legible trust signals
- obvious local context like delivery/pickup availability
- playful but controlled motion and microinteractions
- expressive empty states and status states
- premium merchandising even for secondhand goods
- dashboards should behave like action centers, not thin route hubs
- seller workspaces should feel operationally powerful, not merely informational
- context should survive transitions between listing, seller, chat, compare, and notification surfaces

## 8. Detailed MVP Feature Set

## 8.0 AI-assisted product features

The MVP and immediate post-MVP roadmap should treat AI as a practical support layer across the marketplace.

### Seller-facing AI
- Listing assist:
  - title improvement
  - description clarity improvement
  - tag suggestion
  - category suggestion
  - missing-detail prompts
- Price guidance:
  - realistic price band
  - likely underpricing / overpricing signals
  - sell-faster suggestions
- Seller coaching:
  - listing quality nudges
  - trust-building suggestions
  - stale-listing improvement advice

### Buyer-facing AI
- Search rewrite:
  - convert natural language queries into structured discovery state
- Similarity and compare intelligence:
  - explain meaningful differences between listings
  - suggest better alternatives where relevant
- Chat safety:
  - detect scam phrasing
  - warn against risky payment behavior
  - offer safer reply framing

### Admin-facing AI
- Report summarization
- policy-risk hints
- moderation support signals

### Freemium packaging direction
- Free:
  - basic listing assist
  - basic search rewrite
  - basic chat safety warning
  - limited daily AI actions
- Seller Pro:
  - stronger listing rewrite
  - price guidance
  - seller coaching
  - richer quota
- Admin / Ops:
  - report summarization
  - moderation assistance
  - risk clustering support

## 8.0.1 Notification system

Notifications should be a core product layer, not a generic alert list.

### Notification contexts
- Buying
- Selling
- Safety
- System

### Buyer notification examples
- saved listing sold
- saved listing price dropped
- saved search matched
- seller replied
- meetup updated
- compare item unavailable

### Seller notification examples
- new buyer message
- hold requested
- offer received
- meetup requested
- listing reported
- listing moderated
- listing traction spike

### Safety/system examples
- risky payment warning
- suspicious chat language
- profile/trust reminder
- maintenance or degraded AI state

### Notification behavior
- notifications should support direct actions where relevant
- buying and selling notifications should be visually distinguishable
- safety notifications should feel serious but not chaotic

## 8.1 Marketplace browsing
- Home feed of listings
- Category-based browsing
- Search bar
- Saved search alerts
- Filters:
  - category
  - price range
  - item condition
  - availability
- newest first
- delivery available
- Listing cards
- Listing detail page
- preserved context between browse, detail, seller, compare, and chat
- richer and more trustworthy listing cards

## 8.2 Listing creation
- title
- description
- category
- condition
- price
- negotiable toggle
- images

## 8.3 Analytics and insight surfaces

### Seller analytics
- views
- saves
- chats started
- holds requested
- meetups scheduled
- conversion signals
- listing quality versus performance

### Buyer insights
- saved-listing change alerts
- recently viewed patterns
- compare activity
- interest and category signals where appropriate

### Moderator/admin analytics
- report trends
- severity distribution
- turnaround time
- repeat-offender and risk patterns
- moderation action trends

### Platform analytics
- daily active users
- listing lifecycle events
- feature usage
- conversion funnel
- category supply/demand signals

## 8.4 Admin data access model

Moderator/admin analytics should feel direct in the frontend, but must remain secure.

Approved direction:
- role-scoped direct Supabase-backed reads where safe
- secure analytic views / read models
- controlled admin-only routes where necessary

The system should not expose unrestricted raw admin data to non-admin clients.

## 8.5 Seller workspace and dashboard expectations

### My Listings
- active, reserved, sold, hidden, and archived states
- edit, delete, duplicate, relist, and mark sold
- visible last-modified metadata
- moderation state visibility
- listing performance indicators

### Dashboard
- should act as a daily command center
- surface meaningful action summaries
- show listing, notification, and saved-search intelligence
- provide clear quick return paths into active work
- item status
- preferred meetup/delivery options
- area/location within SRM KTR
- tags

## 8.3 Chat system
- Buyer-to-seller chat
- Listing-specific conversations
- Basic delivery/meetup coordination through chat
- Message history
- Read indicators optional later
- Safety reminders in chat UI

## 8.4 Delivery scheduling
Since you explicitly want scheduling deliveries, this should be modeled as a lightweight coordination system initially.

### Initial approach
- Seller chooses available fulfillment modes:
  - in-person handoff
  - campus drop-off
  - pickup by buyer
  - hostel/block meetup
- Buyer can request delivery/pickup schedule
- Seller can confirm schedule
- Status states:
  - requested
  - accepted
  - reschedule requested
  - completed
  - cancelled

### Important note
Do **not** build a full logistics engine for v1.
Keep it as:
- scheduling workflow
- chat coordination
- status-based tracking

## 8.5 Payments
You mentioned **Razorpay API**.

### Recommended payment approach
Use Razorpay in a controlled and safety-aware way.

#### Options
1. **Initial MVP option**
   - cash on meetup / manual payment / optional online payment
2. **More polished option**
   - Razorpay payment request / order generation flow
3. **Later safer option**
   - platform-mediated prepayment / deposit model if policy permits

### Recommendation
For v1:
- support Razorpay for convenience
- keep core transaction flow simple
- do not build heavy escrow at first unless needed
- be very explicit that payment should only be released in safe conditions

---

## 9. Premium UI/UX Direction

This section defines how the interface should feel at a product level.

### 9.1 Browse experience
The browse experience should feel like a local shopping platform, not a raw listing dump.

Recommended qualities:
- bold hero surfaces for featured categories and campaigns
- smart category shortcuts
- horizontal carousels for themed collections
- dynamic campus-relevant modules
- rich listing cards with strong image treatment
- highly scannable price, condition, and seller trust info
- strong visual hierarchy between urgent, featured, and normal listings

### 9.2 Listing cards
Listing cards are one of the most important surfaces in the product.

Each card should feel information-rich and premium, with potential support for:
- primary image
- title
- price
- original price optional later
- condition
- seller trust badge
- save/favorite button
- fulfillment badge
- distance or locality badge later
- “urgent”, “new”, or “popular” indicators later

The card should support:
- quick save
- quick open
- quick chat later if useful
- expressive hover/tap states

### 9.3 Listing detail page
Listing detail pages should feel highly merchandised and confidence-building.

Important qualities:
- image-first layout
- clear purchase intent actions
- seller trust indicators
- delivery/pickup details clearly visible
- safety reminders in context
- related listings
- item metadata displayed elegantly
- conversational and reassuring UX copy

### 9.4 Visual tone
The visual system should aim for:
- premium typography
- bold accent colors used intentionally
- energetic but not childish layout decisions
- smooth motion
- polished iconography
- rounded but modern component shapes
- strong spacing rhythm
- high-end mobile-first responsiveness

### 9.5 Local commerce personality
The UI should embrace locality and campus behavior:
- “available near you” style modules
- campus-specific recommendation rails
- hostel/academic-life category surfacing
- event and semester-timed merchandising later
- context-aware nudges for meetup and delivery

### 9.6 Guardrail for polish
The UI should never become noisy for the sake of excitement.
The right balance is:
- Amazon-like clarity and utility
- Swiggy-like energy and immediacy
- campus-native personality
- trust-first execution

## 10. Safety Architecture

This is one of the most important parts of the product.

Safety must cover:
- personal safety
- identity safety
- transaction safety
- platform abuse prevention
- scam resistance
- moderation and traceability

---

## 11. Buyer and Seller Safety Principles

### 9.1 Identity safety
- Do not expose sensitive identity info publicly
- Public profile should show limited trust-relevant info only
- Hide email addresses and private contact details by default
- Keep platform messaging internal
- Avoid exposing phone numbers publicly

### 9.2 Personal safety
- Encourage transactions in public campus locations
- Add safe meetup guidance
- Allow reporting of suspicious behavior
- Flag risky accounts/listings
- Keep transaction history for moderation review

### 9.3 Payment safety
- Avoid encouraging off-platform suspicious payment requests
- Warn users against advance payments to unknown users
- Provide scam warnings during payment-related flows
- Provide transaction best-practice guidance

### 9.4 Content safety
- Moderate prohibited items
- Block unsafe or illegal categories
- Filter abusive/spam content
- Report and review harmful listings rapidly

---

## 12. Essential Safety Features for MVP

## 12.1 Platform identity protection
- Supabase Auth-based account system later
- Dev auth bypass only in development mode
- Campus email gating in production phase
- Public profile minimizes exposed data
- Internal user IDs for backend references
- No raw personal details shown unnecessarily

## 12.2 User verification signals
At minimum, show:
- verified campus account badge later
- joined date
- completed profile state
- listing count
- response reliability indicator later

Do **not** show:
- exact hostel room
- personal email
- phone number publicly
- sensitive identifiers

## 12.3 Reporting system
Users must be able to report:
- fraudulent listing
- fake seller
- abusive chat
- suspicious payment request
- prohibited item
- harassment
- impersonation

## 12.4 Blocking system
Users should be able to:
- block another user
- prevent further chat
- hide that user’s listings if needed later

## 12.5 Moderation queue
Moderators need:
- list of reports
- severity levels
- item/user/report history
- actions:
  - warn user
  - hide listing
  - suspend listing
  - suspend account
  - ban account

## 12.6 Safety education surfaces
Built-in safety copy should appear:
- before payment
- before scheduling meetup
- in chat
- on help/safety page
- during suspicious flow triggers

---

## 13. Detailed Safety Failsafes

### 11.1 Identity failsafes
- Private user details never rendered publicly
- Role-based access control for admin-only data
- RLS in Supabase for ownership-based access
- Separate public profile fields from private user fields
- Server-side validation for profile edits
- Audit logging for admin actions

### 11.2 Payment failsafes
- Never trust frontend-only payment confirmation
- Verify Razorpay payment signatures server-side
- Store payment event logs
- Allow manual review for disputed cases
- Add explicit scam warnings:
  - never send money outside official flow without verification
  - avoid paying in advance unless trust conditions are satisfied

### 11.3 Delivery / meetup failsafes
- Recommended safe pickup zones
- Campus public-location guidance
- Delivery slots with logs
- No precise sensitive private location exposure by default
- Delivery status trail for disputes
- Delivery scheduling should use bounded time slots instead of unrestricted free text where possible later

### 11.4 Chat failsafes
- chat rate limiting
- profanity/abuse filtering later
- report chat message flow
- optionally flag suspicious keywords
- preserve conversation logs for moderation
- allow users to block others

### 11.5 Listing failsafes
- prohibited category enforcement
- image count / quality checks
- suspicious keyword detection
- duplicate listing checks later
- pricing anomaly heuristics later
- AI-based spam/fraud scoring later

### 11.6 Platform-wide failsafes
- audit logs
- abuse throttling
- suspicious activity monitoring
- session control
- role-based moderation controls
- soft delete / reversible moderation actions
- incident handling process

---

## 14. Safety Rules and Marketplace Policy Direction

The product should define clear marketplace rules.

### Prohibited listings
- illegal goods
- weapons
- substances
- stolen property
- harassment content
- impersonation-based listings
- unsafe or harmful products
- anything violating campus rules

### Suspicious behavior examples
- asking for payment before trust is established
- refusing reasonable meetup verification
- repeated duplicate spam
- abusive language
- asking to move immediately to untrusted channels
- suspiciously unrealistic deals
- fake product images

### User-facing safety guidance
- Meet in public campus areas
- Do not share unnecessary personal details
- Inspect product before finalizing payment where possible
- Be cautious of pressure tactics
- Report suspicious behavior immediately

---

## 15. Razorpay Integration Brainstorm

Razorpay can help the platform feel more professional, but must be integrated carefully.

### Potential payment modes
- listing payment link
- one-time payment for reservation
- partial advance payment
- full online payment
- COD / manual settlement

### Recommended v1 approach
- keep both online and offline transaction flexibility
- use Razorpay for optional convenience
- payments should be tied to listing/order records
- use backend verification only
- create payment status states:
  - initiated
  - pending
  - paid
  - failed
  - refunded
  - disputed

### Important architectural note
All Razorpay secret usage must remain server-side only.

---

## 16. SRM KTR-Specific Product Opportunities

Since launch is campus-constrained, lean into SRM KTR context.

### Relevant category opportunities
- semester textbooks
- calculators
- lab coats / lab equipment
- hostel storage items
- mini appliances
- desk/chair/furniture
- cycles
- project kits
- gaming accessories
- fashion resale
- room décor

### Useful local trust/safety ideas
- predefined meetup zones around campus
- hostel-area item tagging without exposing sensitive details
- category labels tailored to student needs
- semester move-in / move-out seasonal sale experiences

---

## 17. Scale-Ready Architecture Thoughts

Even though launch is for SRM KTR, build for eventual campus scaling.

### Future scalability assumptions
- multiple campuses table
- listings linked to campus_id
- profile linked to campus_id
- moderation policies possibly campus-specific
- category variants may be campus-specific later
- delivery zones may vary by campus later

### Avoid hardcoding
Do not hardcode:
- only one campus in database design
- only one email domain forever
- only one meetup workflow
- only one moderation policy

---

## 18. Supabase Strategy

## 18.1 Supabase usage
Use Supabase for:
- Postgres database
- Auth
- Storage
- row-level security
- realtime later if needed for chat

## 18.2 Auth plan
### Phase 1
- auth bypass for dev only
- mock user mode locally only

### Phase 2
- Supabase Auth enabled
- email/password or magic link
- campus email restriction later
- verified profile onboarding

### Phase 3
- admin roles
- stronger trust verification
- optional multi-campus auth logic

## 18.3 Secret handling principles
Frontend:
- only public Supabase URL and anon key

Backend/server:
- Supabase service role key
- Razorpay secret
- Chutes API key

Never expose:
- service role key
- Razorpay secret
- Chutes API key

---

## 19. AI Role in the Product

AI should be useful, not gimmicky.

You said you have a **Chutes API key** and want AI to play a useful role in analysis, guidance, tutorial, and product functionality.

### Best AI roles for v1 or near-v1

## 19.1 AI-assisted listing quality
When seller creates a listing:
- improve title
- improve description
- suggest category
- suggest tags
- suggest price band
- warn if listing is too vague

This increases marketplace quality immediately.

## 19.2 AI safety moderation
AI can score:
- spam likelihood
- scam indicators
- prohibited item hints
- abusive text
- duplicate suspicion later

AI should produce:
- moderation score
- flags
- suggestions for human review

It should **not** fully auto-ban users at first.

## 19.3 AI buying assistant later
A chat-style assistant could help users:
- find listings
- compare options
- understand category fit
- get safety reminders
- learn how to transact safely

## 19.4 AI admin assistant
AI can summarize:
- risky users
- repeated reports
- suspicious patterns
- trending categories
- listing quality issues

---

## 20. AI Role in Development Workflow

AI can also help you build this system faster and smarter.

### Useful development-assist AI roles
- schema brainstorming
- RLS brainstorming
- prompt writing
- moderation copywriting
- empty-state UX wording
- edge-case analysis
- testing scenarios
- rollout planning
- API design thinking
- support/help article generation

### Chutes API best-practice usage
Use it server-side for:
- listing enhancement
- moderation scoring
- content analysis
- admin summaries
- recommendation experiments later

Do not call it directly from the frontend with your real key.

---

## 21. Recommended AI Roadmap

### AI Phase 1
- listing title/description enhancement
- category suggestion
- safety/spam scoring

### AI Phase 2
- duplicate listing detection
- recommendation engine
- semantic search
- admin moderation summaries

### AI Phase 3
- buyer assistant
- seller coach
- trust/risk scoring
- campus trend intelligence

---

## 22. Recommended Database Entities

At a minimum, the schema should include entities like:

- campuses
- profiles
- categories
- listings
- listing_images
- favorites
- conversations
- messages
- fulfillment_requests or delivery_schedules
- orders / transactions
- payments
- reports
- moderation_actions
- blocked_users
- audit_logs

### Delivery scheduling entity concept
`delivery_schedules`
- id
- listing_id
- buyer_profile_id
- seller_profile_id
- requested_mode
- proposed_time
- confirmed_time
- status
- notes
- created_at
- updated_at

### Payments entity concept
`payments`
- id
- listing_id
- buyer_profile_id
- seller_profile_id
- order_id
- provider
- provider_payment_id
- amount
- currency
- status
- created_at
- updated_at

---

## 23. Key Product Decisions Recommended Right Now

### Build this as:
- web-first
- mobile-optimized
- single-campus launch
- local exchange model
- optional online payment via Razorpay
- internal chat
- strong moderation
- privacy-first profile model

### Avoid in first version:
- overcomplicated logistics
- full escrow unless truly needed
- public phone number exposure
- open public marketplace beyond campus
- over-automation in moderation
- overly broad feature scope

---

## 24. Final Recommended MVP Definition

### MVP includes
- browse listings
- listing cards
- listing detail pages
- create/edit/delete listing
- search/filter
- buy/sell flows
- chat with seller
- delivery / meetup scheduling
- favorites
- mark sold / reserved
- Razorpay integration
- reporting/blocking
- moderation basics
- strong privacy and safety defaults
- Supabase backend
- dev auth bypass
- production auth path planned
- AI listing assistance
- AI moderation scoring

### MVP does not need yet
- reviews/ratings
- full recommendation engine
- advanced analytics
- multi-campus launch
- auction systems
- heavy logistics engine
- full escrow

---

## 25. Build Order Recommendation

1. Finalize product blueprint
2. Finalize technical stack and architecture
3. Design Supabase schema
4. Design auth abstraction with dev bypass
5. Build listings and browse flow
6. Build seller flows
7. Build chat
8. Build delivery scheduling
9. Build Razorpay backend flow
10. Build reporting and moderation
11. Add AI listing enhancement
12. Add AI moderation scoring
13. Turn on real auth and campus trust rules
14. Polish UI and safety copy

---

## 26. Operating Product Statement

> UniKart is a trusted SRM KTR campus marketplace that enables students to safely buy and sell secondhand goods through structured listings, chat, delivery scheduling, secure payments, and privacy-first safety systems, with a scale-ready foundation for expansion across campuses.

---

## 27. Final Notes

This blueprint intentionally prioritizes:
- trust
- safety
- execution quality
- premium consumer-grade UX
- scale readiness
- practical MVP boundaries
- careful use of AI
- clean integration with Supabase and Razorpay
- an “Amazon × Swiggy” experience adapted for campus commerce

This is the version recommended as the foundation before implementation begins.
