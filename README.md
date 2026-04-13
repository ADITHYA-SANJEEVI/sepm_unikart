# UniKart

Campus commerce without the sketchiness.

UniKart is a campus-first secondhand marketplace built for SRM KTR students to buy, sell, chat, schedule meetups, and move listings through a safer, more structured workflow than random WhatsApp groups or public resale pages.

It combines a custom Next.js frontend, a TypeScript + Express backend, Supabase-backed data flows, and an AI-assisted moderation/enrichment layer aimed at making local student commerce feel fast, trustworthy, and actually usable.

## What is in this repo

- `backend/`: Express API, route handlers, middleware, service layer, and TypeScript source.
- `frontend-v2/`: Next.js App Router frontend and custom UI system.
- `supabase/migrations/`: SQL migrations for marketplace schema and feature rollout.
- `scripts/`: PowerShell and shell helpers for validation, setup, and local workflow support.
- `docs/`: runbooks, model notes, and implementation guidance.
- Root docs like `ROADMAP.md`, `PRODUCT_BLUEPRINT.md`, and `TECHNICAL_OVERVIEW.md`: product direction, architecture, and execution context.

## Core product scope

- Campus-first resale marketplace for SRM KTR
- Listing creation, browsing, detail pages, favorites, and compare flows
- Buyer-seller messaging and scheduling flows
- Safety, moderation, and reportability primitives
- Supabase-powered data and auth plumbing
- AI-assisted listing quality and moderation hooks
- Delivery and meetup coordination support

## Tech stack

- Frontend: Next.js 16, React 19, vanilla CSS design system
- Backend: Node.js, Express 5, TypeScript, Zod
- Data: Supabase / PostgreSQL
- Integrations: Chutes AI, Razorpay, TomTom

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create local env files

Copy the templates:

```bash
copy .env.example .env
copy frontend-v2\.env.local.example frontend-v2\.env.local
```

Then fill in the values you actually use for Supabase, Chutes, TomTom, and any payment credentials.

### 3. Run the backend

```bash
npm run dev:backend
```

The backend defaults to `http://127.0.0.1:4000`.

### 4. Run the frontend

```bash
npm run dev:frontend:v2
```

The frontend dev server defaults to `http://127.0.0.1:3001`.

### 5. Build production artifacts

```bash
npm run build
```

## Useful scripts

- `npm run dev`: run the backend with `tsx`
- `npm run dev:backend`: same as above
- `npm run dev:frontend`: start frontend on port `3000`
- `npm run dev:frontend:v2`: start frontend on port `3001`
- `npm run build:backend`: compile the backend to `dist/`
- `npm run build:frontend:v2`: build the Next.js frontend
- `npm run start`: run compiled backend output
- `start-mvp.cmd`: Windows startup helper that builds, finds free ports, writes frontend env values, and launches both apps

## Environment variables

### Backend `.env`

- `NODE_ENV`
- `PORT`
- `AUTH_OFF`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEV_AUTH_BYPASS_ENABLED`
- `DEV_AUTH_BYPASS_EMAILS`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `CHUTES_API_KEY`
- `CHUTES_BASE_URL`
- `CHUTES_COMPLETIONS_PATH`
- `CHUTES_MODEL`
- `CHUTES_TIMEOUT_SECONDS`
- `TOMTOM_API_KEY`
- `TOMTOM_SEARCH_BASE_URL`
- `TOMTOM_ROUTING_BASE_URL`
- `TOMTOM_MAPS_BASE_URL`

### Frontend `frontend-v2/.env.local`

- `NEXT_PUBLIC_API_BASE`
- `UNIKART_BACKEND_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Local notes

- This repo intentionally ignores `.env`, `frontend-v2/.env.local`, `node_modules`, `.next`, `dist`, logs, and local agent/tooling folders.
- The frontend rewrites `/api/backend/*` to the backend base URL configured by `UNIKART_BACKEND_URL`.
- The repo includes Supabase migrations, product docs, and workflow scripts alongside the application code.

## Suggested flow for contributors

1. Read `ROADMAP.md` and `PRODUCT_BLUEPRINT.md`.
2. Configure local env files from the provided examples.
3. Run backend and frontend in separate terminals.
4. Apply Supabase migrations before testing data-dependent flows.
5. Use the scripts in `scripts/` and `docs/runbook.md` for validation and debugging.

## Status

This repository is an actively evolving MVP codebase for UniKart, with the product direction centered on trusted campus resale, structured discovery, and safety-aware local transactions.
