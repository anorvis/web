# CLAUDE.md — Anorvis Web App

> Inherits base behavior from root `../../CLAUDE.md`. Self-update rules apply here too.

## Overview
Next.js 15 web application with App Router. Provides dashboard, chat, goals, habits, memory, and planner interfaces.

## Tech Stack
- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (in `src/components/ui/`)
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
│   ├── ui/           # Atomic shadcn components
│   ├── utils/        # Theme toggle and utility components
│   ├── layout/       # Shell, nav, styles
│   ├── chat/         # Chat feature
│   └── workspace/    # Domain workspace components
├── hooks/            # Custom React hooks
└── lib/              # Local utilities and anorvis-os gateway helpers
```

## Conventions
- `PascalCase` for components and classes
- `camelCase` for hooks, utils, variables
- Feature components get their own folder under `src/components/`
- Shared atomic components live in `src/components/ui/`
- Style objects in `layout/styles.ts`, not inline

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

## Decisions Log
- 2026-03-19: Banned direct `useEffect`. Enforced via Biome `noRestrictedImports`. Added `useMountEffect()` hook. Migrated 24 effects across 16 files. Ref: Factory's no-useEffect rule.
- 2026-03-15: Removed matrix-js-sdk and all Matrix integration code. Agents on hold — focusing on platform first.
- 2026-03-14: Decided to replace Matrix web integration with direct OpenClaw gateway API (OpenAI-compatible). Simpler, fewer deps.

## Known Gotchas
*None currently.*
