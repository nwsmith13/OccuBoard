-- OccuBoard interview prep workspace

create table if not exists public.interview_prep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  practiced_questions jsonb not null default '[]'::jsonb,
  answer_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interview_prep enable row level security;

drop policy if exists "Users can manage their interview prep" on public.interview_prep;
create policy "Users can manage their interview prep"
  on public.interview_prep
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists interview_prep_user_id_idx on public.interview_prep(user_id);
create index if not exists interview_prep_job_id_idx on public.interview_prep(job_id);
