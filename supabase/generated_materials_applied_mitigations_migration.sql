-- Optional metadata for showing which fit-analysis mitigation strategies were applied
-- when generating resumes, cover letters, and recruiter messages.

alter table public.resume_versions
add column if not exists applied_mitigations jsonb not null default '[]'::jsonb;

alter table public.messages
add column if not exists applied_mitigations jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
