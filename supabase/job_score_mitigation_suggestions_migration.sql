alter table public.job_scores
add column if not exists mitigation_suggestions jsonb not null default '[]'::jsonb;

alter table public.job_scores
add column if not exists gap_assessments jsonb not null default '[]'::jsonb;
