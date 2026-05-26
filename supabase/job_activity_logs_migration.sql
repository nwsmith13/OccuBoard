create table if not exists public.job_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  type text not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.job_activity_logs enable row level security;

drop policy if exists "job activity logs are owned by users" on public.job_activity_logs;
create policy "job activity logs are owned by users" on public.job_activity_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
