# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Tooling and Commands

This is a Next.js App Router project (App Directory) using TypeScript, Tailwind CSS v4, Prisma, and Bun (see `bun.lock`). Prefer Bun for all package and script invocations.

### Package management and dev server

- Install dependencies (preferred): `bun install`
- Run the dev server (preferred): `bun dev`
  - Equivalent underlying script: `next dev`
  - Serves the app at `http://localhost:3000`

### Build, start, and lint

All of these should be run via Bun:

- Build production bundle: `bun run build`
  - Script: `next build`
- Start production server (after build): `bun run start`
  - Script: `next start`
- Lint the codebase: `bun run lint`
  - Script: `eslint`

### Testing

- There is currently **no test script** defined in `package.json` and no obvious test runner (e.g., Vitest/Jest) installed.
- Before suggesting or running tests, first add an appropriate test setup and `test` script to `package.json`.

### Prisma and database

- Prisma schema: `prisma/schema.prisma`
  - Datasource: PostgreSQL via `DATABASE_URL` env var.
  - Client generator output: `../src/generated/prisma`.
- Generated client usage is centralized in `src/lib/prisma-client.ts`, which:
  - Uses `@prisma/adapter-pg` with the `pg` driver and `process.env.DATABASE_URL`.
  - Attaches a singleton `PrismaClient` to `globalThis` in non-production to avoid hot-reload connection storms.
- Standard Prisma CLI commands (e.g., `bunx prisma generate`, `bunx prisma migrate dev`) can be used as needed, but no project-specific npm/bun scripts are defined yet.

## High-Level Architecture

### App entry and routing (Next.js App Router)

- Root app directory: `src/app` (despite the README’s mention of `app/` at the repo root).
- `src/app/layout.tsx`
  - Defines `RootLayout` and global HTML structure.
  - Configures Geist and Geist Mono via `next/font/google`, wiring them into CSS variables `--font-geist-sans` and `--font-geist-mono` (consumed by Tailwind theme in `globals.css`).
  - Exports base `metadata` (title/description) for the app.
- `src/app/page.tsx`
  - Home page component using `next/image` and Tailwind utility classes.
  - Currently a mostly static landing layout with light/dark variants and links out to Next.js/Vercel resources.
- `next.config.ts`
  - Minimal Next.js configuration placeholder with `NextConfig` typed export; extend here for custom routing, headers, etc.

### Styling, theming, and design tokens

- Global styles: `src/app/globals.css`
  - Tailwind v4-style setup via `@import "tailwindcss";` and `@import "tw-animate-css";`.
  - Uses `@theme inline` to map CSS custom properties (e.g., `--background`, `--primary`, `--sidebar-*`, `--chart-*`) to Tailwind theme tokens such as `bg-background`, `text-foreground`, etc.
  - Defines a global `--radius` scale and derived radii used across UI components.
  - Implements a `.dark` scope with dark-mode values for the same token set.
  - `@layer base` applies `border-border` and `outline-ring/50` to all elements and sets `body` background/foreground via design tokens.
- **Important UI rule for agents:**
  - Prefer using existing design tokens and Tailwind utility classes wired through `globals.css` (e.g., `bg-background`, `text-foreground`, `border-border`).
  - **Avoid introducing hard-coded color values** in new styles; use the CSS custom properties / Tailwind tokens already defined.

### UI component system (shadcn + Radix)

- Core reusable UI primitives live in `src/components/ui/*`.
  - Includes components like `button`, `input`, `textarea`, `accordion`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `hover-card`, `kbd`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `toggle`, `toggle-group`, `tooltip`, etc.
  - These are shadcn-style components built largely on top of Radix UI primitives and styled via Tailwind + the design tokens in `globals.css`.
- `src/lib/utils.ts` exposes the standard `cn` helper:
  - `cn(...inputs)` merges Tailwind class names using `clsx` + `tailwind-merge` and should be used for conditional class composition.
- **Important UI usage guidelines for agents:**
  - When building new UIs, **prefer composing from `src/components/ui` components** rather than introducing new ones ad hoc.
  - Do not arbitrarily change the base styling of existing shadcn UI components unless explicitly requested; instead, extend via props, composition, or additional wrapper components.
  - When styling, use tokenized classes (`bg-background`, `text-foreground`, `text-muted-foreground`, etc.) and avoid raw color literals.

### Hooks and responsiveness

- `src/hooks/use-mobile.ts`
  - Provides a `useIsMobile()` hook using `window.matchMedia` with a `MOBILE_BREAKPOINT` of `768px`.
  - Returns a boolean indicating whether the viewport is currently below the mobile breakpoint.
  - Prefer using this hook for responsive behavior that needs to know "mobile vs desktop" on the client rather than duplicating media-query logic.

### Data access and environment configuration

- Prisma configuration:
  - `prisma/schema.prisma` currently defines the datasource and generator but no models yet. When models are added, the generated client will appear under `src/generated/prisma`.
  - `src/lib/prisma-client.ts` centralizes Prisma client instantiation; import the default `prisma` export from here for all database access.
- Environment variables:
  - Database URL is read via `process.env.DATABASE_URL` both in Prisma schema and in the `PrismaPg` adapter.
  - When adding new env vars, ensure they are wired both into Next (via `next.config` or runtime usage) and, if needed, Prisma.

### TypeScript and module resolution

- `tsconfig.json` highlights:
  - Strict TypeScript configuration with `noEmit: true` and `strict: true`.
  - Uses the `next` TypeScript plugin.
  - Path alias `@/*` → `./src/*` is configured.
- **Agent usage note:**
  - Prefer importing internal modules via the `@/` alias (e.g., `@/lib/prisma-client`, `@/components/ui/button`) instead of long relative paths.

## How to Extend This Project Safely

When making changes or adding features:

- Use Bun for script execution and dependency management (`bun install`, `bun dev`, `bun run lint`, etc.).
- Reuse the existing shadcn UI components in `src/components/ui` and the `cn` helper for consistent styling and class composition.
- Respect the design token system in `globals.css`, avoiding raw color values in new CSS.
- Centralize all database access through `src/lib/prisma-client.ts`, and keep Prisma models in `prisma/schema.prisma` with generated output in `src/generated/prisma`.
- Keep imports aligned with the `@/*` path alias defined in `tsconfig.json`.