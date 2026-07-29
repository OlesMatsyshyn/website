-- Public Outreach chapter discussions.
-- Run this once in the Supabase SQL editor for the website project.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null default 'public-outreach'
    check (page_slug = 'public-outreach'),
  chapter_slug text not null
    check (chapter_slug in ('superball', 'yoyo', 'cartesian-diver', 'solar-system-scale')),
  name text not null
    check (char_length(trim(name)) between 1 and 60),
  comment_text text not null
    check (char_length(trim(comment_text)) between 1 and 1200),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  parent_id uuid references public.comments(id) on delete cascade,
  comment_type text not null default 'comment'
    check (comment_type in ('question', 'comment')),
  is_featured boolean not null default false
);

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

alter table public.comments
  add column if not exists comment_type text not null default 'comment'
    check (comment_type in ('question', 'comment'));

alter table public.comments
  add column if not exists is_featured boolean not null default false;

create index if not exists comments_public_outreach_idx
  on public.comments (page_slug, chapter_slug, status, created_at);

create index if not exists comments_parent_idx
  on public.comments (parent_id, status, created_at);

alter table public.comments enable row level security;

drop policy if exists "Read approved Public Outreach comments" on public.comments;
create policy "Read approved Public Outreach comments"
  on public.comments
  for select
  to anon
  using (
    page_slug = 'public-outreach'
    and status = 'approved'
  );

drop policy if exists "Insert pending Public Outreach comments" on public.comments;
create policy "Insert pending Public Outreach comments"
  on public.comments
  for insert
  to anon
  with check (
    page_slug = 'public-outreach'
    and status = 'pending'
    and chapter_slug in ('superball', 'yoyo', 'cartesian-diver', 'solar-system-scale')
    and comment_type in ('question', 'comment')
    and is_featured = false
    and (parent_id is null or comment_type = 'comment')
    and char_length(trim(name)) between 1 and 60
    and char_length(trim(comment_text)) between 1 and 1200
  );

revoke update, delete on public.comments from anon;
grant select, insert on public.comments to anon;

create or replace function public.enforce_public_outreach_approved_comment_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approved_count integer;
  should_check_limit boolean := false;
begin
  if new.page_slug = 'public-outreach' and new.status = 'approved' then
    if tg_op = 'INSERT' then
      should_check_limit := true;
    elsif old.status is distinct from new.status then
      should_check_limit := true;
    end if;
  end if;

  if should_check_limit then
    perform pg_advisory_xact_lock(hashtext('public_outreach_approved_comment_limit'));

    select count(*) into approved_count
    from public.comments
    where page_slug = 'public-outreach'
      and status = 'approved'
      and id is distinct from new.id;

    if approved_count >= 100 then
      raise exception 'The public comment limit has been reached.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists public_outreach_approved_comment_limit on public.comments;
create trigger public_outreach_approved_comment_limit
  before insert or update of status
  on public.comments
  for each row
  execute function public.enforce_public_outreach_approved_comment_limit();
