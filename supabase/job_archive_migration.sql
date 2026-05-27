-- Optional archive support for OccuBoard opportunities.
-- Run in Supabase SQL editor when deploying archive/restore behavior.

alter table public.jobs
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text,
  add column if not exists archived_by_user boolean default false;

create index if not exists jobs_user_archived_idx
  on public.jobs (user_id, archived_at);
