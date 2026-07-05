# Anorvis Web

Private Next.js dashboard/app for Anorvis. Styling is supplied by the public `@anorvis/ui` package so app screens and reusable primitives share the same tokens, CSS variables, Tailwind theme, and workspace style constants.

## Setup

```bash
npm ci --ignore-scripts
npm run dev
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
