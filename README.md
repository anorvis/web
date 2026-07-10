# Anorvis Web

Local-first Next.js dashboard for Anorvis. Styling is supplied by the public `@anorvis/ui` package so app screens and reusable primitives share the same tokens, CSS variables, Tailwind theme, and workspace style constants.

## Requirements

- Node.js 20+
- A running [anorvis-os](https://github.com/anorvis/os) gateway (defaults to `http://127.0.0.1:8787`)

## Install & run

```bash
npm ci --ignore-scripts
npm run dev
```

Open `http://localhost:3000`. The app is local-only: no auth, no database of
its own — all records persist through anorvis-os.

The gateway URL defaults to `http://127.0.0.1:8787`. To change it (or point at
a token-protected gateway), copy `.env.example` to `.env.local` and set
`ANORVIS_OS_URL` / `ANORVIS_OS_API_TOKEN`.

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # serve the production build
npm run test:unit  # unit tests (vitest)
npm run lint       # biome + architecture checks
npm run typecheck  # tsc --noEmit
```

## Styling contract

`src/app/globals.css` imports the public design system:

```css
@import "@anorvis/ui/styles.css";
@source "../../node_modules/@anorvis/ui/src/**/*.{ts,tsx}";
```

Use `@anorvis/ui/*` for primitive components and `@anorvis/ui/styles` for shared style constants. Do not recreate local copies under `src/components/ui`; that would drift from the shared design system.

## License

AGPL-3.0-only. See `LICENSE`.
