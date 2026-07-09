# Anorvis Web Agent Guide

This file records durable engineering preferences. Keep transient project status and change plans out of this file.

## Naming

Use Go-style naming with Google TypeScript guardrails, biased toward Go.

- Prefer short, direct, context-aware names.
- Name length grows with scope and distance from declaration to use.
- Use short locals freely when component/function context is clear: `id`, `env`, `ctx`, `req`, `res`, `url`, `body`, `input`, `err`, `row`, `i`.
- Use fuller names for exported APIs, persisted fields, schemas, public component props, broad scopes, and ambiguous values.
- Avoid ambiguous private dialect abbreviations: no `provConn`, `calEvt`, `hlthDash`, `finAcct`.
- Avoid type noise. Prefer `meal`, `tasks`, `provider`, `body`; avoid `mealObject`, `taskArray`, `providerString`, `parsedJsonValue`.
- Avoid redundant context. Inside a feature module, prefer the local concept name: `meal`, `task`, `id`, `input`.
- Prefer direct verbs: `get`, `list`, `save`, `sync`, `read`, `write`, `parse`.
- Do not create generic buckets named `utils`, `helpers`, `common`, or `misc` unless there is no more specific feature, product, or domain home.

## TypeScript and Effect

- Keep TypeScript strict and boring.
- Use Effect for schemas, decoding, typed errors, workflows, and boundary correctness where it improves maintainability.
- Do not add duplicate validation libraries when existing `effect/Schema` code is the right fit.
- Do not encode information in a variable name that TypeScript already carries in the type.
- Prefer explicit boundary decoding over trusting external JSON.

## Product Boundary

- Product-specific views should call durable capabilities through explicit boundary helpers.
- Durable data/actions belong in capability/backend modules, not in UI-only code.
- Web-specific dashboards and projections should not be modeled as shared capabilities just because they read shared data.
- Reusable styling and component behavior belongs in the shared UI package before it is duplicated locally.
