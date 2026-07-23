-- Solenis Calculations — initial schema
-- Run in the Supabase SQL editor or via the Supabase CLI.

create extension if not exists "pgcrypto";

create table if not exists public.calculations (
  id text primary key,
  slug text not null unique,
  title text not null,
  description text not null,
  category text not null default 'general',
  href text not null,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.calculation_runs (
  id uuid primary key default gen_random_uuid(),
  calculation_id text not null references public.calculations (id) on delete cascade,
  inputs jsonb not null,
  outputs jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists calculation_runs_calculation_id_idx
  on public.calculation_runs (calculation_id);

create index if not exists calculation_runs_created_at_idx
  on public.calculation_runs (created_at desc);

alter table public.calculations enable row level security;
alter table public.calculation_runs enable row level security;

-- Public read of the calculation catalog
create policy "calculations are publicly readable"
  on public.calculations
  for select
  using (true);

-- Allow anonymous inserts of calculation runs (tighten once auth is added)
create policy "anyone can insert calculation runs"
  on public.calculation_runs
  for insert
  with check (true);

create policy "anyone can read calculation runs"
  on public.calculation_runs
  for select
  using (true);

insert into public.calculations (id, slug, title, description, category, href, is_available, sort_order)
values (
  'polymer-973-adipic-deta',
  'polymer-973-adipic-deta',
  'Polymer 973 — Adipic Acid:DETA Ratio',
  'Calculate Adipic Acid and DETA charges from a batch size or either reactant mass.',
  'polymer',
  '/calculations/polymer-973-adipic-deta',
  true,
  1
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  href = excluded.href,
  is_available = excluded.is_available,
  sort_order = excluded.sort_order;
