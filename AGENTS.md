# AGENTS.md — E-commerce Project

## Stack

### Next.js (CRITICAL VERSION)
- **Next.js 15.4.6** (App Router) + React 19
  - ⚠️ **THIS EXACT VERSION IS REQUIRED** for Cloudflare Pages deployment via `@cloudflare/next-on-pages`
  - DO NOT upgrade or downgrade without verifying `@cloudflare/next-on-pages` compatibility first
  - Any version change can break the Cloudflare Workers runtime

### Supabase
- Backend for auth, database, SSR, and real-time subscriptions
  - Use `@supabase/ssr` for server-side operations
  - Use `@supabase/supabase-js` for client-side operations
  - ALL database queries MUST go through Supabase client — never raw SQL unless it's a migration file
  - ⚠️ **ALL DATABASE MIGRATIONS MUST BE RUN VIA CLI (`npx supabase db push`)** — Never via the web SQL Editor.

### UI & Testing
- Tailwind CSS + shadcn/ui (style: `new-york`, RSC enabled)
- Vitest for tests

## Dev Commands
```bash
npm run dev      # local dev server
npm run build    # production build
npm run lint     # eslint
npm run test     # vitest (watch)
npm run test:run # vitest single run
```

## Git Workflow
- `main` → stable, never push directly
- `staging` → integration branch, always branch from here
- Prefix: `feature/` or `fix/`
- Branch: `git checkout staging && git pull && git checkout -b feature/your-feature`

## Path Aliases (@/)
Configured in `tsconfig.json`:
- `@/*` → project root (`./*`)
- `@/features/*` → `src/features/*`
- `@/shared/*` → `src/shared/*`
- `@/components/*` → `components/`
- `@/lib/*` → `lib/`
- `@/components/ui/*` → `components/ui/`

## Architecture
- **Pages** (`app/**/page.tsx`): Server Components by default
- **Interactive components** (`components/**/*.tsx`): `"use client"` directive
- **Features** (`src/features/*/`): Feature-based code organization
  - Each feature has: `actions/`, `components/`, `hooks/`, `repositories/`, `services/`, `types/`
  - POS: `src/features/pos/`
  - Cart: `src/features/cart/`
  - Products: `src/features/products/`
  - Orders: `src/features/orders/`
  - Admin: `src/features/admin/`
  - Auth: `src/features/auth/`
  - Profile: `src/features/profile/`
- **Shared** (`src/shared/*/`): Cross-feature utilities
  - `components/`: Layout (Navbar, Footer), Providers (Cart, License)
  - `hooks/`: Custom React hooks
  - `utils/`: Utility functions
 - **Types**: `src/features/*/types/`, `src/shared/types/`, `types/*.ts`
 - **Server Actions**: `src/features/*/actions/*.ts`, `lib/actions/*.ts`
 - **Utils**: `lib/utils.ts`, `lib/format.ts`
 - **Icons**: Lucide React + Phosphor Icons

## Product Components (`components/products/`)
- **Container/Orchestrator**: `ProductGrid.tsx` — manages state, filtering, search, delegates to child components
- **Presentational**: `ProductCard.tsx`, `ProductSearch.tsx`, `ProductCategoryFilter.tsx`, `ProductEmptyState.tsx` — receive props, no business logic
- **Feature**: `ProductImageGallery.tsx`, `ProductVariantSelector.tsx`, `AddToCartButton.tsx`, `RelatedProductsCarousel.tsx` — self-contained interactive features
- **Reusable UI**: `PriceDisplay.tsx`, `QuantitySelector.tsx` — shared across multiple components
- **Tests**: co-located `*.test.tsx` (e.g., `ProductVariantSelector.test.tsx`)
- **Types**: domain types (`Product`, `SKU`, `Category`, `GalleryImage`, `OptionDef`) in `types/product.types.ts`; component `Props` types stay local
- **Rules**: always use shadcn/ui (`Button`, `Badge`, `Input`, `Alert`), `next/image` for images, `lib/format.ts` for currency/stock formatting, never hardcode colors or magic numbers

## shadcn/ui Components
- Source: `components/ui/`
- Config: `components.json`
- Add: `npx shadcn@latest add <component>`
- Reusable: Modal/AlertDialog/ConfirmDialog → `components/ui/modal.tsx`

## CSS / Design System
- CSS variables in `app/globals.css` (e.g. `--primary`, `--color-primary`)
- **Always use CSS variables** — never hardcode colors
- Design tokens in `docs/SPEC.md`

## Code Conventions
- All code, comments, files in **English**
- `camelCase` for variables/functions, `PascalCase` for components/types
- SOLID principles apply
- Document non-obvious logic with comments

## Component Reuse Rule
- **ALWAYS check existing components before creating new ones.** The codebase already has well-tested components that handle most common use cases.
- Search `components/`, `src/shared/components/`, and `src/features/*/components/` first.
- Reuse shadcn/ui components from `components/ui/` — do not recreate dialogs, modals, buttons, inputs, etc.
- Reuse branding components from `components/branding/` — do not recreate logo/name displays.
- Reuse product components from `components/products/` — do not recreate cards, grids, selectors, etc.
- Only create a new component if no existing component covers the use case, or if the existing one needs a significantly different behavior that would break its current contracts.
- Keep code clean: no dead code, no unused imports, no commented-out blocks, no TODOs left without issue references.

## Branding System

### Purpose
The e-commerce supports two separate brand identities:

- **PRIGMA** (the developer) — used in the license overlay, admin footer, and blocked messages. Everything related to the platform itself.
- **Store Brand** (each client) — used in the navbar, footer, SEO metadata, about page, transactional emails, and admin sidebar title. This is the client-facing identity.

This separation allows a single codebase to serve multiple clients, each with their own store branding, while PRIGMA's platform branding remains consistent.

### Config Files

- **`lib/constants/branding-store.ts`** — exports `storeBranding` object. Contains all client-facing data:
  - `name`, `description`, `url`, `locale`
  - `contact`: `phone`, `email`, `address`, `city`, `country`
  - `whatsapp`
  - `social`: links (Facebook, Instagram, TikTok, etc.)
  - `legal`: `foundingYear`, `copyrightName`
  - `assets`: `logo` (path to the store's logo image)
  - `about`: `stats`, `story`, `tagline`, `mission`, `vision`
  - All values are in Spanish (target clients are Colombian businesses).

- **`lib/constants/branding-prigma.ts`** — exports `prigmaBranding` object. Contains all PRIGMA-specific data:
  - `company`: name
  - `email`, `whatsapp`
  - `assets`: `logo` (path to PRIGMA's logo), `backgroundImage`
  - `tagline`

### Reusable Components (`components/branding/`)

All branding components follow the same pattern: they read from their respective config by default, but every prop can be overridden.

- **`<StoreLogo />`** — renders the store's logo via `next/image`. Reads `storeBranding.assets.logo` by default.
  - Optional props: `src` (image path), `alt` (alt text), `size` (`"sm"` | `"md"` | `"lg"`), `className`.
- **`<StoreName />`** — renders the store's name. Reads `storeBranding.name` by default.
  - Optional props: `as` (renders as `span`, `h1`, `p`, etc.), `className`.
  - Accepts `children` to override the name entirely.
- **`<PrigmaLogo />`** — renders PRIGMA's logo via `next/image`. Reads `prigmaBranding.assets.logo` by default.
  - Optional props: `src` (image path), `alt` (alt text), `size` (`"sm"` | `"md"` | `"lg"`), `className`.

### Design Principle
Components always read from their config by default, but ALL accept optional props for overrides. This keeps branding centralized (a single source of truth per identity) while still allowing per-instance customization where needed.

### Rebranding Process
- **New client**: edit `branding-store.ts` and replace images in `public/images/`. PRIGMA config stays untouched.
- **PRIGMA rebrands**: edit `branding-prigma.ts` only. Store clients are unaffected.

## Key Flows
- **Cart validation**: `POST /api/cart/validate` → stock + price checks
- **Stock reservation**: `POST /api/cart/reserve` (15min hold on `/checkout`)
- **POS**: `app/pos/page.tsx` + `app/admin/pos/*`
- **Wompi webhook**: `POST /api/webhooks/wompi` (payment confirmation)

## Existing Instruction Files
Toda la documentación técnica y de arquitectura vive en la carpeta `docs/`. **AGENTES Y DESARROLLADORES DEBEN LEER ESTA CARPETA ANTES DE HACER NADA**.
- `docs/project-context.md` — Estructura del proyecto, reglas de oro.
- `docs/deploy.md` — Reglas de despliegue en Cloudflare.
- `docs/supabase.md` — Convenciones de base de datos y migraciones.
- `docs/SPEC.md` — POS system spec, data models, API endpoints.
- `docs/cart-validation-system.md` — Fases de reserva de stock del carrito.

## Testing
- Vitest with jsdom + `@testing-library/react` + `@testing-library/user-event`
- Test files: `*.test.ts` or `*.test.tsx` co-located
- Run single test: `npm run test:run -- path/to/test.test.ts`