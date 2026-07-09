# CLAUDE.md — Anorvis Web App

> Inherits durable repo conventions from `AGENTS.md`. Naming rules there are authoritative unless this file is stricter.

## Overview
Next.js 15 web application with App Router. Provides local-first dashboards for overview, life, health, finance, integrations, memory, and planner interfaces.

## Tech Stack
- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4 through `@anorvis/ui/styles.css` and exported style tokens
- **UI Components**: `@anorvis/ui`; do not add local component-library primitives in this app
- **Agent backend**: local anorvis-os gateway
- **Auth/Database**: intentionally none; local-only app
- **Linter/Formatter**: Biome (2-space indent)
- **Deployment**: local-first

## Commands
```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Production build
npm run lint      # Biome lint
npx biome check   # Full Biome check
npx tsc --noEmit  # Type check
```

## Structure
```
src/
├── app/              # Next.js App Router (pages + API routes)
├── components/
│   ├── utils/              # App-specific wrappers around @anorvis/ui behavior
│   └── layout/             # App shell composition and workspace re-exports
├── hooks/            # Custom React hooks
└── lib/              # Local utilities and anorvis-os gateway helpers
```

## Conventions
- `PascalCase` for components and classes
- `camelCase` for hooks, utilities, variables, and local functions
- Naming follows `AGENTS.md`: short, direct, context-aware names; name length grows with scope; avoid type noise and ambiguous private abbreviations
- Feature components stay under `src/features/<domain>/components/`
- Reusable styling and component behavior belongs in `@anorvis/ui`, not this app
- Small page-specific class overrides are allowed; general UI primitives, variants, and style tokens must be changed in the sibling UI repo first

## useEffect Ban
**Direct `useEffect` is banned.** Enforced by Biome `noRestrictedImports` (error-level). Instead:
- **Mount-time sync** (DOM, subscriptions, timers): `useMountEffect()` from `@/hooks/use-mount-effect`
- **Derived state**: compute inline or `useMemo`
- **Data fetching on navigation**: call in the event handler, not via effect
- **Prop-change reset**: use `key` prop to remount the component
- **User actions**: handle in the event handler directly

New custom hooks that genuinely need `useEffect` go in `src/hooks/` with a `biome-ignore` on the import. Components never import `useEffect` from React.

## Lessons Learned
- Web app backend code should be local-only and route persistent/external capabilities through anorvis-os, not hosted auth/database providers.
- `@anorvis/ui` is the component library. The committed lockfile makes `https://github.com/anorvis/ui/tarball/main` reproducible at the fetched revision; refresh the lockfile intentionally when the web app should pick up newer UI changes. Use local `file:../ui` only as a temporary development override, and do not commit it.

## Decisions Log
- 2026-03-19: Banned direct `useEffect`. Enforced via Biome `noRestrictedImports`. Added `useMountEffect()` hook. Migrated 24 effects across 16 files. Ref: Factory's no-useEffect rule.
- 2026-03-15: Removed matrix-js-sdk and all Matrix integration code. Agents on hold — focusing on platform first.
- 2026-03-14: Decided to replace Matrix web integration with direct OpenClaw gateway API (OpenAI-compatible). Simpler, fewer deps.

## Known Gotchas
*No durable gotchas recorded.*
