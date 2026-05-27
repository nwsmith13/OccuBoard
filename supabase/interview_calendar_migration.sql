-- OccuBoard interview and calendar handoff fields.
-- Safe to run more than once.

alter table public.jobs
  add column if not exists interview_date date,
  add column if not exists interview_time text,
  add column if not exists interview_duration integer,
  add column if not exists interview_location text,
  add column if not exists interview_type text,
  add column if not exists interviewer_contact_id uuid,
  add column if not exists calendar_event_added_at timestamptz,
  add column if not exists followup_calendar_added_at timestamptz;

comment on column public.jobs.interview_date is 'Optional interview date for calendar handoff and interview prep reminders.';
comment on column public.jobs.interview_time is 'Optional local interview time, stored as HH:MM text for lightweight calendar export.';
comment on column public.jobs.interview_duration is 'Optional interview duration in minutes.';
comment on column public.jobs.interview_location is 'Optional interview location, phone number, or video link.';
comment on column public.jobs.interview_type is 'Optional interview type: Phone, Video, In person, or Other.';
comment on column public.jobs.interviewer_contact_id is 'Optional related job_contacts id for the interviewer or recruiter.';
comment on column public.jobs.calendar_event_added_at is 'Optional timestamp for the last interview calendar handoff.';
comment on column public.jobs.followup_calendar_added_at is 'Optional timestamp for the last follow-up calendar handoff.';
