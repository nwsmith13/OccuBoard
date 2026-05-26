-- OccuBoard job contacts / recruiter tracking
-- Run this in Supabase SQL Editor after the core schema is installed.

create table if not exists public.job_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  title text,
  company text,
  email text,
  phone text,
  linkedin_url text,
  source text not null default 'recruiter'
    check (source in ('recruiter', 'hiring_manager', 'referral', 'company_contact', 'other')),
  last_contacted_at timestamptz,
  next_follow_up_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_contacts enable row level security;

-- RLS note: all policies below scope rows to auth.uid() = user_id so each user
-- can only read and mutate contacts they created.
drop policy if exists "Users can read their job contacts" on public.job_contacts;
create policy "Users can read their job contacts"
  on public.job_contacts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their job contacts" on public.job_contacts;
create policy "Users can insert their job contacts"
  on public.job_contacts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their job contacts" on public.job_contacts;
create policy "Users can update their job contacts"
  on public.job_contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their job contacts" on public.job_contacts;
create policy "Users can delete their job contacts"
  on public.job_contacts for delete
  using (auth.uid() = user_id);

create index if not exists job_contacts_user_id_idx on public.job_contacts(user_id);
create index if not exists job_contacts_job_id_idx on public.job_contacts(job_id);

-- Optional: associate generated messages with a saved contact.
alter table public.messages
  add column if not exists contact_id uuid references public.job_contacts(id) on delete set null;
