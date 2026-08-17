# Solenis Calculations

Plant calculation and inspection tools for Solenis production processes.

## Stack

- **React Router 8** (framework mode + Vite SSR)
- **Prisma 7** ORM against **Supabase Postgres**
- **remix-auth** + **FormStrategy** (email/password)
- **Vercel** (`@vercel/react-router` preset) — functions run in **Sydney (`syd1`)** close to the plant
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

Open [http://localhost:5173](http://localhost:5173). Sign in with a seeded account (see Auth below).

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
- `/approvals` — managers and admin review pending runs
- `/history` — calculation submission history and approval status
- `/inspections` — inspection checklist catalog
- `/inspections/history` — completed inspection records
- `/settings` — managers and admin enable/test phone push notifications
- `/operators` — managers and admin add/remove operator names

Roles:

| Role | Purpose |
|---|---|
| `OPERATOR` | Shared plant-floor login; submits calculations and inspections |
| `MANAGER` | Personal email login; approves/rejects; manages operator names |
| `ADMIN` | One admin account; same review and operator management as manager |

Seed credentials (override with env):

- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (also accepts legacy `SEED_USER_*`)
- `SEED_OPERATOR_EMAIL` / `SEED_OPERATOR_PASSWORD` (shared operator login)
- Optional `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` / `SEED_MANAGER_NAME`

Seed also creates placeholder operator names (`Operator A`–`D`) for the calculator dropdown. Managers can add/remove operators at `/operators`.

### Approval workflow

1. Operator selects who is running the batch, enters weights, and clicks **Submit for approval**.
2. The run is stored as `PENDING`.
3. A manager/admin opens **Approvals**, reviews the numbers, and **Approves** or **Rejects**.
4. Managers/admin can enable **phone push notifications** on `/approvals` (requires VAPID env keys).

Optional env:

- `APP_BASE_URL` — canonical site URL for push notification deep links (default / recommended: `https://solenis-calculations.vercel.app`)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — Web Push for managers

### Manager phone setup

1. Sign in as manager/admin and open **Settings**.
2. Optionally install the site to your phone home screen.
3. Tap **Enable on this device** and allow notifications.
4. Tap **Send test notification** to confirm it arrives.
5. New pending calculations will then push a notification that opens Approvals.

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
- `APP_BASE_URL` (recommended: `https://solenis-calculations.vercel.app`)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (optional; manager phone push)

The React Router Vercel preset lives in `react-router.config.ts`.

## Calculators

| Calculator | Route |
|---|---|
| Polymer 973 — Adipic Acid:DETA Ratio | `/calculations/polymer-973-adipic-deta` |
| Polymer AN04 — Adipic Acid:DETA Ratio | `/calculations/polymer-an04-adipic-deta` |

### Polymer Adipic:DETA formula

Plant flow: charge ~90% DETA via drum/IBC pallets, then Adipic Acid, and enter each load weight to get the remaining DETA.

| Product | Mass ratio (Adipic:DETA) | Adipic fields | Adipic validation | Initial DETA fields |
|---|---|---|---|---|
| Polymer 973 | `4000 / 3195.2` → `1.2518778167` | 4 | 950–1020 kg | 4 |
| Polymer AN04 | `5500 / 3899` → `1.4106181072` | 6 | min 480 kg | 5 |

```
target DETA (kg) = Adipic Acid (kg) × (DETA parts / Adipic parts)
extra DETA (kg)  = target DETA − DETA already charged
```

Weights shown for charged/extra/target DETA and Adipic are whole kilograms.

## Inspections

Inspections live on `/inspections` (separate from calculations on the home page). Managers (and admin) can create inspections and questions from **Inspections → Manage** in the nav.

Question types:

| Type | Operator input | Needs-attention |
|---|---|---|
| Yes / No | Yes or No | Usually **No** (configurable) |
| Text box | Free text | Not auto-flagged |
| Number | Numeric value | Not auto-flagged |
| Date | Date picker | Not auto-flagged |
| Radio | Custom options | Manager picks which options flag attention |
| Checkboxes | Multi-select options | Manager picks which options flag attention |

Default seeded inspections:

| Inspection | Route |
|---|---|
| Forklift — Daily Safety Check (Form 78) | `/inspections/forklifts` |
| Daily Start-up | `/inspections/daily-startup` |
| Daily Shut-down | `/inspections/daily-shutdown` |

Completed inspections can be opened from **Inspections → Records**. Each record (and the history list) has **Download PDF**, which produces a human-readable copy of every answered field, notes, actions, and the operator signature.

## Permits

Permits live on `/permits`, with their own records and management (separate from inspections).

| Page | Route |
|---|---|
| Permit dashboard (pending + open) | `/permits/dashboard` |
| Issue a permit | `/permits` |
| Permit records | `/permits/history` |
| Manage permit forms | `/permits/manage` |
| Permit sign-off settings | `/permits/settings` |
| Safe Work Permit (Form 42801) | `/permits/safe-work-permit` |

Issuing a permit assigns a shared **YYMMXXX** permit number (e.g. `2608002`) used across Safe Work, Hot Work, and Line Break forms, and submits it as **pending authorization**. Duration is calculated from start and end time and cannot exceed **12 hours**. The first authorized person must sign on issue; additional authorized people may sign optionally. Eligible Operations representative / Account manager, Maintenance representative / Account technician, and Safe work coordinator users get a push notification (one per person even with multiple roles). Approvers must confirm a job-site visual inspection before signing. The same person cannot sign more than one role. Once **two different people** have signed, the permit becomes **open**; a third signature can still be added afterward. Close out with date, time, and operator/maintenance initials when work is finished. Retain closed permits for at least one year.

Each permit record (and the records list) has **Download PDF**. The PDF includes every form field, calculated duration, authorized personnel signatures, authorisation slot signatures (including unsigned slots), and close-out initials when present.

## Scripts

- `npm run dev` — local development (React Router + Vite)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run typecheck` — typegen + TypeScript
- `npm run db:migrate` — create/apply migrations in development
- `npm run db:deploy` — apply migrations in CI/production
- `npm run db:seed` — seed calculation and inspection catalogs
- `npm run db:studio` — open Prisma Studio
