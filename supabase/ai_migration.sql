create table if not exists public.job_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  keywords text[] not null default '{}',
  recommendation text not null,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.job_scores enable row level security;
alter table public.messages enable row level security;
alter table public.resume_versions add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_resume_versions_updated_at on public.resume_versions;
create trigger set_resume_versions_updated_at
  before update on public.resume_versions
  for each row execute procedure public.set_updated_at();

drop policy if exists "job scores are owned by users" on public.job_scores;
drop policy if exists "messages are owned by users" on public.messages;

create policy "job scores are owned by users" on public.job_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages are owned by users" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
