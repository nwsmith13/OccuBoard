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

alter table public.profiles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.resume_uploads enable row level security;

drop policy if exists "resume uploads are owned by users" on public.resume_uploads;
create policy "resume uploads are owned by users" on public.resume_uploads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resume files are owned by users" on storage.objects;
create policy "resume files are owned by users" on storage.objects
  for all using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);

notify pgrst, 'reload schema';
