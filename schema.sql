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

-- Season Invites tab (Settings): tracks next-season re-invite outreach to
-- renters from the two most recent seasons. This table already exists in
-- the live database (confirmed directly against the REST API — not present
-- in this file's history, so it was created outside this repo's convention,
-- same as several other tables here). Documented below to match what's
-- actually live, not an idealized version: confirmed empirically that the
-- live table has NEITHER the status check constraint NOR a uniqueness
-- constraint on (renter_id, season_year) — an insert with an invalid status
-- string, and a second insert duplicating an existing (renter_id,
-- season_year) pair, both succeeded in a live test. The app only guards
-- against duplicate rows at the application layer (season_invites.js checks
-- for an existing row before inserting); there is no database-level backstop
-- today. The two commented-out statements below would add both — run them
-- in the Supabase SQL editor for project pvxhokdoainxoknfmacy if desired;
-- neither has been applied.
--
-- create table if not exists season_invites (
--   id uuid primary key default gen_random_uuid(),
--   renter_id uuid references renters(id) not null,
--   season_year integer not null,
--   proposed_start date,
--   proposed_end date,
--   proposed_rent numeric,
--   status text not null default 'not_sent',
--   notes text,
--   created_at timestamptz default now(),
--   updated_at timestamptz default now()
-- );
-- alter table season_invites enable row level security;
-- create policy "public access" on season_invites for all using (true) with check (true);

-- Not yet applied — would add the integrity season_invites currently lacks:
-- alter table season_invites add constraint season_invites_status_check check (status in ('not_sent', 'sent', 'confirmed', 'lease_sent', 'lease_signed', 'declined', 'not_returning'));
-- alter table season_invites add constraint season_invites_renter_id_season_year_key unique (renter_id, season_year);

-- Lease generation (Season Invites): stores the Google Drive view URL of the
-- generated lease document for a renter. Already exists in the live
-- database (confirmed via the REST API) — not something this ALTER needs to
-- apply, just documenting it here to match the rest of this file's practice.
--
-- ALTER TABLE season_invites ADD COLUMN lease_url text;

-- Tasks: category field (Tasks screen). Confirmed live via the REST API that
-- tasks.category does not exist yet (tasks itself is another table, like
-- season_invites, that predates this file and isn't otherwise documented
-- here) — this ALTER has not been applied. The app degrades gracefully
-- without it (every task reads as uncategorized, flat list, no grouping
-- headers), but saving a task with a category selected will fail until this
-- is run. Run it in the Supabase SQL editor for project pvxhokdoainxoknfmacy
-- before using the category selector.
--
-- ALTER TABLE tasks ADD COLUMN category text;
--
-- Valid values are enforced by the app only (null, 'winterize',
-- 'new_season_setup') — no check constraint, matching this file's existing
-- practice of not adding one unless asked.
