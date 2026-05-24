alter table public.jobs add column if not exists followup_status text not null default 'none';
alter table public.jobs add column if not exists followup_completed_at timestamptz;
alter table public.jobs add column if not exists followup_snoozed_until date;
alter table public.jobs add column if not exists followup_note text;

comment on column public.jobs.followup_status is 'In-app follow-up reminder status: none, scheduled, due, overdue, completed, or snoozed. Due/overdue are derived in the app from followup_date.';
comment on column public.jobs.followup_completed_at is 'Timestamp when the user marked the follow-up complete.';
comment on column public.jobs.followup_snoozed_until is 'Date until which the follow-up reminder is snoozed.';
comment on column public.jobs.followup_note is 'Optional user note for the next follow-up.';
