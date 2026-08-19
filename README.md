# Hercules 1612

Plant calculation and inspection tools for Hercules 1612 production processes.

## Stack

- **React Router 8** (framework mode + Vite SSR)
- **Prisma 7** ORM against **Supabase Postgres**
- **remix-auth** + **FormStrategy** (email/password)
- **Netlify** (`@netlify/vite-plugin-react-router`) — SSR via Netlify Functions; set region to **Sydney (`syd`)** for low latency at the plant
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
- `/settings` — managers and admin enable devices and choose which permit, inspection, and calculation alerts they receive
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
4. Managers/admin can enable **phone push notifications** on **Settings** (requires VAPID env keys) and choose which permit, inspection, and calculation alerts they receive.

Optional env:

- `APP_BASE_URL` — canonical site URL for push notification deep links (default / recommended: `https://hercules1612.com`)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — Web Push for managers

### Manager phone setup

1. Sign in as manager/admin and open **Settings**.
2. Optionally install the site to your phone home screen.
3. Tap **Enable on this device** and allow notifications. The first registration opts this account into every alert type.
4. Under **What you receive**, turn off any permit, inspection, or calculation alerts you do not want.
5. Tap **Send test notification** to confirm it arrives.

### Netlify deployment

#### 1. Create a Netlify site

1. Sign in at [app.netlify.com](https://app.netlify.com).
2. **Add new site → Import an existing project** and connect your Git provider (GitHub, GitLab, or Bitbucket).
3. Select this repository. Netlify reads `netlify.toml` automatically:
   - **Build command:** `npm run build`
   - **Publish directory:** `build/client`
   - **Node version:** 22

#### 2. Set environment variables

In Netlify: **Site configuration → Environment variables**. Add the variables below for **Production** (and **Deploy previews** if you want previews to work with the database).

See [Environment variables](#environment-variables) for how to find or generate each value.

#### 3. Choose the Sydney function region (recommended)

The plant is in Australia, so run server-side code close by:

1. **Site configuration → Functions → Function region**
2. Select **Asia Pacific (Sydney) — `syd`**
3. Redeploy the site for the change to take effect

> **Note:** Custom function regions require a **Netlify Pro** (or Enterprise) plan. On the free tier, functions run in US East (Ohio) by default — the app still works, but page loads may feel slower.

#### 4. First deploy

1. Trigger a deploy (push to `main` or click **Deploy site**).
2. The build runs `prisma migrate deploy` automatically when `DIRECT_URL` is set.
3. If build-time migration times out on Supabase, sign in as admin and open **`/admin/db-migrate`** to apply pending migrations manually.
4. Seed data is **not** run on deploy — run `npm run db:seed` locally against your Supabase database once, or use `/admin/db-migrate` → **Seed default inspections** after migrations.

#### 5. Custom domain (optional)

1. **Domain management → Add a domain** (e.g. `hercules1612.com`).
2. Follow Netlify’s DNS instructions.
3. Set `APP_BASE_URL` to your custom domain (e.g. `https://hercules1612.com`).

#### 6. Manager push notifications (optional)

After deploy, managers can enable phone alerts on **Settings**. Requires the VAPID env vars (see below).

The Netlify React Router plugin lives in `vite.config.ts`. Build settings are in `netlify.toml`.

### Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supabase → **Project Settings → Database → Connection string → URI** (Transaction pooler, port **6543**). Append `?pgbouncer=true` if not present. |
| `DIRECT_URL` | Recommended | Same Supabase page → **Session mode** connection string (port **5432**). Used for Prisma Migrate at build time and locally. |
| `SESSION_SECRET` | **Yes** | Generate a long random string, e.g. `openssl rand -base64 32` in a terminal. Used to sign login cookies. |
| `APP_BASE_URL` | Recommended | Your public site URL, e.g. `https://hercules1612.netlify.app` or your custom domain. Used for push notification deep links. |
| `VAPID_PUBLIC_KEY` | Optional | Generate with `npx web-push generate-vapid-keys --json`. Needed for manager phone push. |
| `VAPID_PRIVATE_KEY` | Optional | Same command as above — keep the private key secret. |
| `VAPID_SUBJECT` | Optional | A contact URI, e.g. `mailto:manager@company.com`. |
| `SEED_ADMIN_EMAIL` | Local/seed only | Override default admin email when running `npm run db:seed` locally. |
| `SEED_ADMIN_PASSWORD` | Local/seed only | Override default admin password when seeding. |
| `SEED_OPERATOR_EMAIL` | Local/seed only | Shared operator login email for seeding. |
| `SEED_OPERATOR_PASSWORD` | Local/seed only | Shared operator login password for seeding. |

**Supabase step-by-step**

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and open your project (or create one).
2. **Project Settings** (gear icon) → **Database**.
3. Under **Connection string**, choose **URI** and copy:
   - **Transaction pooler** → paste into `DATABASE_URL` (port 6543).
   - **Session pooler** or **Direct connection** → paste into `DIRECT_URL` (port 5432).
4. Replace `[YOUR-PASSWORD]` with your database password (reset under **Database → Database password** if needed).
5. For Australia, create the Supabase project in **ap-southeast-2 (Sydney)** if possible — this keeps DB latency low alongside Netlify `syd` functions.

**Generate `SESSION_SECRET`**

```bash
openssl rand -base64 32
```

Copy the output into Netlify env vars (no quotes needed).

**Generate VAPID keys (push notifications)**

```bash
npx web-push generate-vapid-keys --json
```

Copy `publicKey` → `VAPID_PUBLIC_KEY`, `privateKey` → `VAPID_PRIVATE_KEY`, and set `VAPID_SUBJECT=mailto:you@company.com`.

Netlify injects `URL`, `DEPLOY_PRIME_URL`, and `CONTEXT` automatically — you do not need to set these.


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

Completed inspections can be opened from **Inspections → Records**. Each record has **View PDF**, which opens a readable copy of every answered field, notes, actions, and the operator signature. From there you can share, download, or close the PDF (including when installed as a home-screen app).

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

Each permit record has **View PDF**. The PDF includes every form field, calculated duration, authorized personnel signatures, authorisation slot signatures (including unsigned slots), and close-out initials when present. From the viewer you can share, download, or close the PDF.

## Scripts

- `npm run dev` — local development (React Router + Vite)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run typecheck` — typegen + TypeScript
- `npm run db:migrate` — create/apply migrations in development
- `npm run db:deploy` — apply migrations in CI/production
- `npm run db:seed` — seed calculation and inspection catalogs
- `npm run db:studio` — open Prisma Studio
