# Public Outreach Comments Setup

The Public Outreach discussion forms use the shared public Supabase client in `js/supabase-client.js`. `js/comments.js` reuses that client. No database password, service-role key, or private key belongs in browser code.

The private credential folder must remain local and untracked:

- `secret/supabase/supabase_api_public.txt` contains the public URL and public key used by the frontend.
- `secret/supabase/supabase_ps.txt` is private and must not be used by the static website.

## 1. Database table

The browser expects the table `public.comments` with these columns:

- `id`
- `page_slug`
- `chapter_slug`
- `name`
- `comment_text`
- `status`
- `created_at`
- `parent_id`
- `comment_type`
- `is_featured`

Allowed `chapter_slug` values are:

- `superball`
- `yoyo`
- `cartesian-diver`
- `solar-system-scale`

Run `supabase/comments-setup.sql` in the Supabase SQL editor if this table and its RLS policies have not already been created.

## 2. Required RLS behavior

Row Level Security should enforce:

- public visitors can select only comments where `status = 'approved'`;
- public visitors can insert only comments with `status = 'pending'`;
- public visitors cannot update or delete comments;
- at most 100 approved Public Outreach comments may exist publicly.

The website also validates display names at 1-60 characters and comments at 1-1200 characters before submission. Visitor text is rendered as plain text, never as HTML.

Threading uses one level only:

- top-level questions and comments have `parent_id = null`;
- replies have `parent_id` set to the approved top-level comment id;
- replies use `comment_type = 'comment'`;
- replies to replies are intentionally disabled in the frontend.

The public form no longer asks visitors to choose a type. New top-level submissions use `comment_type = 'comment'`. Existing approved rows with `comment_type = 'question'` remain supported and display with a small Question label. New submissions and replies should set `is_featured = false`.

Names are optional in the public form. If a visitor leaves the name field blank, the frontend submits `name = 'Reader'` so the database still receives a non-empty value.

## 3. Browser integration

`public-outreach.html` loads:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-client.js"></script>
<script src="js/comments.js"></script>
```

If the Supabase CDN or database is unavailable, the page remains usable and the discussion boxes show an unavailable state instead of throwing console errors. Chapter discussions are collapsed by default and approved comments are loaded when a reader opens a discussion.

## 4. Moderation

New questions, comments, and replies are inserted with `status = 'pending'` and are not displayed immediately.

To approve a top-level comment or question:

1. Open the Supabase dashboard.
2. Go to Table Editor.
3. Open `public.comments`.
4. Filter for `page_slug = public-outreach` and `status = pending`.
5. Review the comment text.
6. Change `status` to `approved` to publish it, or `rejected` to keep it hidden.

To approve a reply, follow the same process. A reply has a non-empty `parent_id`; after approval it appears under the approved top-level parent comment. Do not set a reply's `parent_id` to another reply, because the public interface supports only one reply level.

Only approved comments are loaded by public visitors.

## 5. News subscriptions

The News subscription form also reuses `js/supabase-client.js`. Run `supabase/news-subscriptions-setup.sql` in the Supabase SQL editor before enabling live subscriptions.

The migration creates `public.news_subscriptions` and the RPC function `public.submit_news_subscription(subscriber_email text, selected_topics text[])`. Public visitors are granted execute permission only on that function. They are not granted direct read, list, update, or delete access to subscriber rows.

## 6. CAPTCHA / Turnstile preparation

For stronger spam protection, add Cloudflare Turnstile through a Supabase Edge Function. The static website may contain only the public Turnstile site key. The Turnstile secret key must stay in Supabase secrets, never in this repository.
