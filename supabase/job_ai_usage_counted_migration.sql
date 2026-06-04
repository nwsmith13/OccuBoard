alter table public.jobs
  add column if not exists ai_usage_counted_at timestamptz;
