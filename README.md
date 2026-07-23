# Solenis Calculations

Plant calculation tools for Solenis production processes.

## Stack

- **React Router 8** (SSR framework mode)
- **Supabase** (Postgres catalog + calculation run history)
- **Vercel** (`@vercel/react-router` preset)
- **Tailwind CSS 4** + **shadcn/ui**
- **Conform** + **Zod** for forms

## Getting started

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial.sql` in the SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (and optionally `SUPABASE_SERVICE_ROLE_KEY`) in `.env` and in the Vercel project env.

Without Supabase configured, the app still runs using a local fallback calculation catalog.

### Vercel

```bash
npx vercel link
npx vercel env pull .env
npm run build
```

The React Router Vercel preset is configured in `react-router.config.ts`.

## Calculators

| Calculator | Route |
|---|---|
| Polymer 973 — Adipic Acid:DETA Ratio | `/calculations/polymer-973-adipic-deta` |

### Polymer 973 formula

Uses molecular weights Adipic Acid `146.14 g/mol` and DETA `103.17 g/mol` with a target molar ratio (default `1.0` Adipic : `1.0` DETA) to convert:

- total reactant mass, or
- Adipic Acid charge, or
- DETA charge

into paired plant charges and mass/molar ratios.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run typecheck` — typegen + TypeScript
