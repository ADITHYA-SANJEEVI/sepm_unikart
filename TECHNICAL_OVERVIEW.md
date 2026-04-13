# UniKart Technical Overview & Architecture

This document consolidates the technical architecture, design philosophy, algorithms, and testing methodologies that power the UniKart MVP platform. It provides a plain-English, high-level understanding of the codebase without modifying any technical files.

---

## 1. Core Technology Stack

UniKart is built on a modern, full-stack JavaScript/TypeScript ecosystem aimed at safety, speed, and premium user experience (an "Amazon × Swiggy" aesthetic).

### Frontend (The UI)
*   **Next.js (v16+) & React (v19):** Powers the user interface, handling routing, component rendering, and application state. React provides the interactivity.
*   **Custom Design System (Vanilla CSS):** Instead of using Tailwind or Bootstrap, the app relies on a massive `globals.css` file (`~2200 lines`). It acts as a customized UI library ("Lego bricks"). It defines CSS variables for brand colors (e.g., `--brand-deep`), shadows (`--shadow-hover`), and component classes (`.hero-card`, `.sell-button`) to ensure a completely bespoke, highly-polished experience across the app.

### Backend (The Server)
*   **Node.js & Express (`^5.2.1`):** Acts as the API gateway. It receives frontend requests, validates them, and queries the database.
*   **TypeScript:** Provides type-safety, dramatically reducing bugs by enforcing strict rules on how data moves through the app.
*   **Zod (`^4.3.6`):** The primary data validation library. It mathematically ensures that all data hitting the backend perfectly matches the required shapes and constraints before touching the database.

### Infrastructure & External Services
*   **Supabase (PostgreSQL):** The core database engine and authentication provider. It handles relational data (listings, users) and complex security rules.
*   **Razorpay:** Planned/used for handling marketplace payment routing.
*   **Chutes API:** An external LLM specifically integrated for AI-driven moderation and listing enhancements.

---

## 2. Key Mechanisms & "Algorithms"

While UniKart relies more on robust CRUD (Create, Read, Update, Delete) operations than complex mathematical algorithms, it implements strict procedural logic for core features.

### A. Real-Time Listing Previews
When a seller drafts a listing, the UI previews it instantaneously:
*   **Mechanism:** Two-Way Data Binding via React State (`useState`/`useReducer`).
*   **Execution:** As the user types, an `onChange` listener instantly writes the values to a JSON object in the browser's memory. The React component re-renders the preview card from this memory instantly.
*   **Image Handling:** Dragged-and-dropped images use the browser's `URL.createObjectURL(file)` API. This creates a temporary, localized "blob URL" allowing the image to render in the preview card instantly with zero server upload lag.

### B. The AI Pipeline (Chutes Integration)
The Chutes AI API operates silently on the server-side to improve quality.
1.  **Trigger:** The user submits a listing.
2.  **Prompt Construction:** The backend traps the submission and injects the raw title/description into a strict system prompt (e.g., *"Analyze this item. Suggest categories. Fix grammar."*).
3.  **Inference Call:** The backend securely pings the Chutes API using a protected server key (never exposed to the frontend).
4.  **Application:** The LLM returns a structured JSON response. Zod validates the AI's response, and if passed, the improved listing is saved to Supabase. 

### C. The Moderation Funnel (Fraud Finding)
UniKart uses a tiered approach to filter out abuse before it reaches buyers.
1.  **Regex Matching (Fast):** Submissions are immediately scanned against a hardcoded array of banned keywords (e.g., fake assignments, weapons). Matches are auto-blocked.
2.  **Statistical Anomalies (Medium):** The backend compares the user's `price` against the historical average for that `category`. Unrealistic deviations (e.g., an iPhone for ₹500) trigger a flag.
3.  **AI Fraud Scoring (Deep):** The Chutes API evaluates the context for subtle social-engineering scams.
4.  **Result:** Flagged listings are saved to the database but their `status` is forced to `Pending_Review` rather than `Active`, making them invisible until a human admin approves them.

### D. Delivery Coordination (State Machine)
Rather than a live GPS logistics engine, UniKart coordinates physical meetups using a Finite State Machine (FSM).
*   The `delivery_schedules` table has a strict `ENUM` status: `['Requested', 'Accepted', 'Reschedule_Needed', 'Completed', 'Cancelled']`.
*   The Node.js backend enforces **State Transition Rules**. A buyer can request a cancellation, but the backend computationally prevents a buyer from unilaterally moving the status from `Requested` to `Accepted`. Only the listing owner can do that.

---

## 3. Safety & Security Architecture

Safety isn't an afterthought; it is structurally bound to the database.

*   **Row Level Security (RLS):** Supabase uses deep PostgreSQL rules to protect data. A policy is written stating: *"Users can only view private profile details if their `auth.uid()` matches the row's `owner_id`"*. This means even if a hacker explicitly asks the backend for someone's exact room number, the database itself mathematically blocks the query.
*   **The Twin-Profile Model:** UniKart separates sensitive identity data (`auth.users`) from safe, public-facing marketplace data (`public.profiles`), ensuring standard API calls naturally exclude dangerous data leaks.
*   **Server-Side Secrets:** Razorpay keys and Chutes API configurations exist strictly on the Express backend, fundamentally inaccessible to frontend inspection tools.

---

## 4. Testing & Acceptance Methodology

The MVP phase utilized a "Startup Agile" approach rather than heavy unit-testing frameworks (like Jest).

*   **PowerShell Smoke Tests:** For Phase 2 backend features, custom `.ps1` scripts were written to act like "robotic users." After compiling the backend, these scripts shoot `POST` and `GET` requests to the local server to guarantee it returns `200 OK` statuses and the correct JSON shapes. This verifies backward compatibility instantly without UI clicking.
*   **Developer Sandbox (Auth Bypass):** The system uses a `NEXT_PUBLIC_DEV_AUTH_EMAIL` environment variable. When present, the app forcefully bypasses real Supabase password requirements, allowing you to seamlessly swap identities and simulate buyer-seller chats frictionlessly.
*   **Defensive Rendering (Resilience):** Acceptance criteria demanded that the app fail gracefully. If the database crashes or an image URL is suddenly missing, the React components utilize error boundaries and fallback UI (gray placeholders) to prevent a total React "White Screen of Death".
*   **Visual UI Audits:** Because the platform prioritizes a highly energetic, premium CSS aesthetic, testing also relied heavily on manual audits to ensure pixel-perfect rendering, correct drop-shadows, and the solving of text-encoding anomalies (Mojibake text).
