alter table public.resume_versions
  add column if not exists updated_at timestamptz not null default now();

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

notify pgrst, 'reload schema';
