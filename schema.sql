-- Run these in the Supabase SQL editor for project pvxhokdoainxoknfmacy

create table if not exists owner_use (
  id uuid primary key default gen_random_uuid(),
  week_start date unique not null,
  notes text,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- Migration: add partial-week columns to existing owner_use table
-- ALTER TABLE owner_use ADD COLUMN start_date date;
-- ALTER TABLE owner_use ADD COLUMN end_date date;

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  type text not null check (type in ('cleaning', 'repair')),
  title text not null,
  date date not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists comment_overrides (
  id uuid primary key default gen_random_uuid(),
  week_start date unique not null,
  comment text,
  updated_at timestamptz default now()
);

-- Enable row-level security (open read/write for V1 — no auth)
alter table owner_use enable row level security;
alter table appointments enable row level security;
alter table comment_overrides enable row level security;

create policy "public access" on owner_use for all using (true) with check (true);
create policy "public access" on appointments for all using (true) with check (true);
create policy "public access" on comment_overrides for all using (true) with check (true);
