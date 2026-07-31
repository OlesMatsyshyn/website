-- News subscriptions.
-- Run this once in the Supabase SQL editor for the website project.

create table if not exists public.news_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (char_length(email) between 3 and 320),
  email_normalized text generated always as (lower(btrim(email))) stored,
  topics text[] not null
    check (
      coalesce(array_length(topics, 1), 0) >= 1
      and topics <@ array['academia', 'quant', 'creative']::text[]
    ),
  subscribed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  active boolean not null default true
);

create unique index if not exists news_subscriptions_email_normalized_key
  on public.news_subscriptions (email_normalized);

alter table public.news_subscriptions enable row level security;

drop policy if exists "No public read access to news subscriptions" on public.news_subscriptions;
drop policy if exists "No public insert access to news subscriptions" on public.news_subscriptions;
drop policy if exists "No public update access to news subscriptions" on public.news_subscriptions;
drop policy if exists "No public delete access to news subscriptions" on public.news_subscriptions;

revoke all on public.news_subscriptions from anon;
revoke all on public.news_subscriptions from authenticated;

create or replace function public.set_news_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists news_subscriptions_updated_at on public.news_subscriptions;
create trigger news_subscriptions_updated_at
  before update
  on public.news_subscriptions
  for each row
  execute function public.set_news_subscription_updated_at();

create or replace function public.submit_news_subscription(
  subscriber_email text,
  selected_topics text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  normalized_topics text[];
begin
  normalized_email := lower(btrim(coalesce(subscriber_email, '')));

  select array_agg(distinct topic order by topic)
    into normalized_topics
  from unnest(coalesce(selected_topics, array[]::text[])) as topic
  where topic in ('academia', 'quant', 'creative');

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Please enter a valid email address.'
      using errcode = '22023';
  end if;

  if normalized_topics is null or array_length(normalized_topics, 1) < 1 then
    raise exception 'Please choose at least one topic.'
      using errcode = '22023';
  end if;

  if array_length(normalized_topics, 1) <> array_length(coalesce(selected_topics, array[]::text[]), 1) then
    raise exception 'One or more selected topics are not allowed.'
      using errcode = '22023';
  end if;

  insert into public.news_subscriptions (email, topics, active)
  values (normalized_email, normalized_topics, true)
  on conflict (email_normalized)
  do update set
    email = excluded.email,
    topics = excluded.topics,
    active = true;
end;
$$;

revoke all on function public.submit_news_subscription(text, text[]) from public;
grant execute on function public.submit_news_subscription(text, text[]) to anon;
