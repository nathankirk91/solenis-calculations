# Solenis Calculations

Plant calculation tools for Solenis production processes.

## Stack

- **React Router 8** (framework mode + Vite SSR)
- **Prisma 7** ORM against **Supabase Postgres**
- **remix-auth** + **FormStrategy** (email/password)
- **Vercel** (`@vercel/react-router` preset)
- **Tailwind CSS 4** + **shadcn/ui**
- **Conform** + **Zod** for forms

## Getting started

```bash
cp .env.example .env
# Fill in DATABASE_URL + DIRECT_URL from Supabase → Project Settings → Database
# Set SESSION_SECRET to a long random string
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in with the seeded user (defaults: `admin@solenis.local` / `changeme`).

Without `DATABASE_URL`, login cannot verify users against Prisma. Calculators require authentication.

### Database (Supabase + Prisma)

1. Create a Supabase project.
2. Copy the **pooled** connection string (port `6543`, append `?pgbouncer=true`) into `DATABASE_URL`.
3. Copy the **direct/session** connection string (port `5432`) into `DIRECT_URL`.
4. Set `SESSION_SECRET` to a long random string.
5. Apply schema and seed:

```bash
npx prisma migrate deploy
npm run db:seed
```

Prisma Client is generated to `generated/prisma` (gitignored) via `postinstall` / `npm run db:generate`.

### Auth (remix-auth FormStrategy)

- `/login` — email/password form
- `/logout` — clears the session cookie
- Home and calculator routes require a signed-in user

Seed credentials (override with env):

- `SEED_USER_EMAIL` (default `admin@solenis.local`)
- `SEED_USER_PASSWORD` (default `changeme`)

### Vercel

```bash
npx vercel link
npx vercel env pull .env
npm run build
```

Set these on the Vercel project:

- `DATABASE_URL` (required for login + persistence)
- `DIRECT_URL` (optional on Vercel; needed for local/CI migrations)
- `SESSION_SECRET` (required for secure cookies)

The React Router Vercel preset lives in `react-router.config.ts`.

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

- `npm run dev` — local development (React Router + Vite)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run typecheck` — typegen + TypeScript
- `npm run db:migrate` — create/apply migrations in development
- `npm run db:deploy` — apply migrations in CI/production
- `npm run db:seed` — seed calculation catalog
- `npm run db:studio` — open Prisma Studio
