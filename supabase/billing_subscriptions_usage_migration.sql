-- Sprint 13: Stripe subscriptions + free usage limits.

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text default 'free',
  status text default 'free',
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  welcome_email_sent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_subscriptions
add column if not exists welcome_email_sent boolean default false;

create table if not exists public.user_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  job_analyses_used int default 0 check (job_analyses_used >= 0),
  resume_generations_used int default 0 check (resume_generations_used >= 0),
  application_count int default 0 check (application_count >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_subscriptions enable row level security;
alter table public.user_usage enable row level security;

drop policy if exists "Users can read own subscription" on public.user_subscriptions;
create policy "Users can read own subscription"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own usage" on public.user_usage;
create policy "Users can read own usage"
on public.user_usage
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage" on public.user_usage;
create policy "Users can insert own usage"
on public.user_usage
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own usage" on public.user_usage;
create policy "Users can update own usage"
on public.user_usage
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_subscriptions_updated_at on public.user_subscriptions;
create trigger user_subscriptions_updated_at
before update on public.user_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists user_usage_updated_at on public.user_usage;
create trigger user_usage_updated_at
before update on public.user_usage
for each row execute function public.set_updated_at();

-- Server-side Stripe webhook writes require a Supabase service role key in deployment
-- because users should not be able to write subscription status from the browser.
