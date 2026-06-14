-- Optional cover-letter generation metadata used to preserve the selected tone.

alter table public.messages
add column if not exists tone_mode text;

alter table public.messages
add column if not exists tone_notes text;

notify pgrst, 'reload schema';
