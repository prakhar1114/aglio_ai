AI‑Powered QR Menu – Frontend Design Document

Last updated: 12 Jun 2025

⸻

1 Purpose & Scope

A mobile‑first, Pinterest‑style menu web‑app that serves multiple restaurants from a single code‑base. This document details the client architecture, data contracts, theming, and rollout procedure so other engineers (or Cursor AI) can generate code confidently.

⸻

2 High‑Level Architecture

 ┌─────────────┐   NPM                    ┌────────────┐
 │ core build  │── packages──────────────▶│ Restaurant │
 │  (@qrmenu/*)│                         │ wrapper SPA│
 └─────────────┘                         └────────────┘
        ▲                                        ▲
        │ run‑time fetch                         │ deploy static assets
        ▼                                        ▼
 ┌──────────────────────────┐            ┌────────────────────────┐
 │ Theme JSON  /config     │            │  Edge CDN  (Pages)     │
 │ Feed API    /feed?host= │◀───────────│  + Service‑worker/PWA  │
 └──────────────────────────┘            └────────────────────────┘

Layer A – Core (universal): published as @qrmenu/core, @qrmenu/ui, @qrmenu/theme-loader.

Layer B – Restaurant wrapper: 20‑line repo created by CLI; contains theme.json and any component overrides.

⸻

3 Tech Stack

Concern	Choice
Build/PWA	Vite (JS)
UI/Theming	Tailwind CSS + shadcn/ui
Routing/Modals	React Router 6
Data fetching/cache	TanStack Query (useInfiniteQuery)
Local state	Zustand (cart, UI flags)
Masonry + Virtual	@egjs/react-grid
Lazy bundling	React.lazy + Suspense
Testing	Playwright, Vitest, Lighthouse‑CI
Monorepo tooling	Turborepo (optional)


⸻

4 Package Layout (Core)

packages/
 ├─ core/            # <App/> shell, routing, logic
 ├─ ui/              # ItemCard, PromotionBanner, etc.
 ├─ theme-loader/    # loadTheme() util
 └─ …

pnpm -r build generates ESM bundles; each is published to npm.

⸻

5 Feed Data Contract (v1)

// GET /feed?host=mydiner.com&cursor=xyz
{
  items: [
    { kind: 'food',      id: 'burger',        /* … */ },
    { kind: 'promotion', id: 'promo42', fullBleed: true, /* … */ },
    { kind: 'video',     id: 'story21', url: '…', fullBleed: true }
  ],
  nextCursor: 'abc123'
}

Supported kind
	•	food – menu item (image, name, price…)
	•	promotion – banner with CTA; may set fullBleed (100 vw)
	•	instagram – oEmbed JSON for IG post
	•	video / story – mp4/HLS, poster, autoplay flags

Fields rank, colSpan, fullBleed dictate masonry layout.

⸻

5A Backend REST API (v2.0)

The client speaks to a multi‑tenant FastAPI backend documented by the OpenAPI 3.1 spec (v2.0.0).  Each request must include an x-session-id header so the server can link anonymous behaviour to upsell logic.  For now we create a UUID v4 once and cache it in localStorage.

// util/session.js (core)
export function getSessionId () {
  const k = 'qr_session_id';
  let s = localStorage.getItem(k);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(k, s);
  }
  return s;
}

Base URL

Resolved at runtime via import.meta.env.VITE_API_BASE or a per‑tenant value embedded in /config.

⸻

1 GET /menu/

Returns an array of MenuItem objects used to fill the scrolling grid.

Param (query)	Purpose
group_category	Filter by high‑level category
category_brief[]	One or more sub‑categories
is_veg	Veg only (bool)
price_cap	Max price (number)

Always pass x-session-id in headers – not as query.

Client wrapper

// api/menu.js
import { useInfiniteQuery } from '@tanstack/react-query';
import { getSessionId } from '@/utils/session';
export const useMenu = (filters = {}) =>
  useInfiniteQuery({
    queryKey: ['menu', filters],
    queryFn: ({ pageParam }) =>
      fetch(`${BASE_API}/menu/?cursor=${pageParam ?? ''}`, {
        headers: { 'x-session-id': getSessionId() }
      }).then(r => r.json()),
    getNextPageParam: (last) => last.nextCursor,
  });

Image URL helper

If image_url ≠ null, build:

imgSrc = `${BASE_API}/${item.image_url}`;

Else fall back to /placeholder.png.

⸻

2 GET /categories/

Provides counts for the filter sheet and “Veg / Non‑veg” badge.

[
  {
    "group_category": "Pizza",
    "category_brief": "Neapolitan",
    "total_count": 12,
    "veg_count": 5
  }
]

Hook:

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () =>
      fetch(`${BASE_API}/categories/`, {
        headers: { 'x-session-id': getSessionId() }
      }).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });


⸻

Future endpoints (not yet wired)
	•	/upsell/ – called when Cart opens; send cart JSON as query.
	•	/featured/ & /prev_orders/ – replace hard‑coded promos with personalised blocks.

Fail‑soft rule: any 5xx or network error silently turns the feed into offline mode; cached /menu & /categories responses are served from IndexedDB via TanStack persist.

6 Core Components (ui/)

Component	Role
MasonryFeed	wraps @egjs/react-grid; infinite scroll
FeedItemSwitcher	runtime union → renders correct card
ItemCard	food tile with Add → Qty stepper
PromotionBanner	image/CTA; overridable per brand
FullBleedVideo	100 vw video section; plays on view
BottomBar	fixed nav: cart badge, filters, AI
UpsellPopup	appears 5 s after cart first opens
AIChatDrawer	LLM chat; toggles from BottomBar

All components consume CSS variables (e.g. var(--brand)) so brands re‑skin instantly.

⸻

7 Lazy‑Loading Strategy

Asset/Logic	Lazy Technique
Component JS	React.lazy(() => import('./Heavy.jsx'))
Images	<img loading="lazy"> + CDN query params
IG/TikTok embeds	fetch oEmbed only when 50 % visible (IntersectionObserver)
Videos/Stories	mount <video> on view; unload when ≥2 viewports away
Feed pages	TanStack useInfiniteQuery cursor pagination
Upsell popup	setTimeout(5000) + localStorage.onceUpsellShown
App shell	Pre‑cached by vite-plugin-pwa


⸻

8 Theming & Restaurant Customisation

public/theme.json example

{
  "brandColor": "#D9232E",
  "fontHeading": "'Poppins', sans-serif",
  "logo": "https://cdn.mycdn.com/logo.png",
  "instagram": "@mydiner",
  "extras": {
    "heroBanner": "promo42"
  }
}

@qrmenu/theme-loader injects variables:

:root {
  --brand: #D9232E;
  --font-heading: 'Poppins', sans-serif;
}

Tailwind config extends these variables via tailwind.config.js.

Overriding a component

Add file src/overrides/PromotionBanner.jsx; alias it via Vite:

// vite.config.js (wrapper)
resolve: { alias: { '@qrmenu/ui/PromotionBanner': '/src/overrides/PromotionBanner.jsx' } }


⸻

9 Initialisation Workflow (CLI)

pnpm dlx create-qrmenu cool-cafe   # scaffolds wrapper repo
cd cool-cafe && pnpm i            # installs @qrmenu/*
pnpm dev                           # Vite live reload

Scaffolder tasks:
	1.	Copies boot file src/main.jsx:

import { createRoot } from 'react-dom/client';
import { App } from '@qrmenu/core';
import { loadTheme } from '@qrmenu/theme-loader';
loadTheme().then(theme => createRoot(document.getElementById('root')).render(<App theme={theme} />));

	2.	Writes public/theme.json from prompts.
	3.	Adds brand icons to public/.

⸻

10 Runtime Flow
	1.	Request → index.html & bundled JS from CDN.
	2.	loadTheme() → GET /config (same origin) → inject CSS vars.
	3.	<App> mounts; TanStack Query fetches first /feed?host=<domain> page.
	4.	Feed renders; lazy components & assets load on‑demand.
	5.	Cart & AI chat use shared backend endpoints; state kept in Zustand.

⸻

11 Deployment & Upgrades

Task	Action
Core update	publish @qrmenu/*@x.y.z
Wrapper bump	pnpm up @qrmenu/core @qrmenu/ui → pnpm build
CI	GitHub Actions: lint, test, Light‑house budget, Storybook chromatic
Hosting	Cloudflare Pages / Netlify; edge‑cached

No rebuild needed for theme tweaks or feed changes; only static wrapper assets change.

⸻

12 Adding a New Restaurant (Cheat‑sheet)
	1.	pnpm dlx create-qrmenu new‑resto
	2.	Edit public/theme.json + logos.
	3.	Add DNS CNAME to CDN origin.
	4.	pnpm build & deploy.
	5.	Backend whitelists host → serves menu data.

Total work ≈ 10 min.

⸻

13 Scalability & Future Integrations
	•	New content type → extend feed union & add new component in ui/.
	•	Move to GraphQL if union friction grows.
	•	Edge‑compute AB tests by injecting promotions server‑side (no client changes).
	•	SSR or React Server Components can replace Vite later without breaking API contract.

⸻

14 Testing & Quality Gates
	•	Vitest unit tests for utility functions & stores.
	•	Storybook for UI regression.
	•	Playwright e2e (mobile viewport ✕ 2 brands).
	•	Lighthouse‑CI budget: TTI < 3 s on Moto G4.

⸻

15 Glossary

Term	Meaning
Feed item	Any block rendered in the scrolling grid (food, banner, story…)
Full‑bleed	Occupies 100 vw; ignores masonry columns
Wrapper	Per‑restaurant repo containing only branding & overrides
Core	Universal logic & UI published as versioned npm pkgs


⸻

End of Document