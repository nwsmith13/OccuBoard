create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  location text,
  phone text,
  target_roles text,
  base_resume_text text,
  linkedin_url text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists portfolio_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title text not null,
  location text,
  remote_type text not null default 'Remote',
  salary_range text,
  job_description text,
  source_url text,
  priority text not null default 'Medium',
  status text not null default 'Saved',
  date_saved date not null default current_date,
  applied_date date,
  followup_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs add column if not exists remote_type text not null default 'Remote';
alter table public.jobs add column if not exists priority text not null default 'Medium';
alter table public.jobs add column if not exists date_saved date not null default current_date;
alter table public.jobs add column if not exists applied_date date;
alter table public.jobs add column if not exists followup_date date;
alter table public.jobs add column if not exists notes text;
alter table public.jobs add column if not exists updated_at timestamptz not null default now();

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  stage text not null default 'Saved',
  applied_date date,
  followup_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.applications add column if not exists updated_at timestamptz not null default now();

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  title text not null,
  content text,
  tailoring_intensity text,
  recommendation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resume_versions add column if not exists updated_at timestamptz not null default now();
alter table public.resume_versions add column if not exists tailoring_intensity text;
alter table public.resume_versions add column if not exists recommendation text;

create table if not exists public.job_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  keywords text[] not null default '{}',
  transferable_strengths jsonb not null default '[]'::jsonb,
  better_aligned_roles jsonb not null default '[]'::jsonb,
  recommendation text not null,
  summary text,
  tailoring_intensity text,
  created_at timestamptz not null default now()
);

alter table public.job_scores add column if not exists transferable_strengths jsonb not null default '[]'::jsonb;
alter table public.job_scores add column if not exists better_aligned_roles jsonb not null default '[]'::jsonb;
alter table public.job_scores add column if not exists tailoring_intensity text;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  storage_path text,
  extracted_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at
  before update on public.applications
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_resume_versions_updated_at on public.resume_versions;
create trigger set_resume_versions_updated_at
  before update on public.resume_versions
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.notes enable row level security;
alter table public.resume_versions enable row level security;
alter table public.activity_logs enable row level security;
alter table public.job_scores enable row level security;
alter table public.messages enable row level security;
alter table public.resume_uploads enable row level security;

drop policy if exists "profiles are owned by users" on public.profiles;
drop policy if exists "jobs are owned by users" on public.jobs;
drop policy if exists "applications are owned by users" on public.applications;
drop policy if exists "notes are owned by users" on public.notes;
drop policy if exists "resume versions are owned by users" on public.resume_versions;
drop policy if exists "activity logs are owned by users" on public.activity_logs;
drop policy if exists "job scores are owned by users" on public.job_scores;
drop policy if exists "messages are owned by users" on public.messages;
drop policy if exists "resume uploads are owned by users" on public.resume_uploads;
drop policy if exists "resume files are owned by users" on storage.objects;

create policy "profiles are owned by users" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "jobs are owned by users" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "applications are owned by users" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes are owned by users" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "resume versions are owned by users" on public.resume_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "activity logs are owned by users" on public.activity_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "job scores are owned by users" on public.job_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages are owned by users" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "resume uploads are owned by users" on public.resume_uploads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resume files are owned by users" on storage.objects
  for all using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
