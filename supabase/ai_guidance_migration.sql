alter table public.job_scores
  add column if not exists transferable_strengths jsonb not null default '[]'::jsonb,
  add column if not exists better_aligned_roles jsonb not null default '[]'::jsonb,
  add column if not exists tailoring_intensity text;

alter table public.resume_versions
  add column if not exists tailoring_intensity text,
  add column if not exists recommendation text;

notify pgrst, 'reload schema';
