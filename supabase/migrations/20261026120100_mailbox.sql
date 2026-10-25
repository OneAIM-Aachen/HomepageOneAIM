-- ============================================================================
-- Mailbox: incoming emails of the sender account (e.g. aachen@one-aim.org),
-- read via IMAP by the edge function "sync-mailbox", plus team replies.
--
-- • mailbox_messages: one row per incoming email, matched to a person and,
--   where possible, to the exact submission:
--     matched_by = 'thread'  → reply to one of our emails (exact application)
--                  'sender'  → sender address belongs to a person
--                  'manual'  → linked by the team
--                  null      → unknown sender
-- • mailbox_state: sync progress (last IMAP UID).
-- • email_log gets person_id / threading headers so team replies
--   (template 'reply') belong to the same conversation.
-- ============================================================================

create table public.mailbox_state (
  id            boolean primary key default true check (id),
  uid_validity  bigint,
  last_uid      bigint not null default 0,
  -- First sync only reads emails received after this date
  sync_since    date not null default (current_date - 90),
  last_sync_at  timestamptz,
  last_error    text
);
insert into public.mailbox_state (id) values (true) on conflict do nothing;

create table public.mailbox_messages (
  id             uuid primary key default gen_random_uuid(),
  uid_validity   bigint not null,
  uid            bigint not null,
  message_id     text,                      -- Message-ID header
  in_reply_to    text,
  references_ids text[] not null default '{}',
  from_email     extensions.citext,
  from_name      text,
  to_text        text,
  cc_text        text,
  subject        text not null default '',
  body_text      text not null default '',
  attachments    jsonb not null default '[]',   -- [{ fileName, size, mimeType }]
  received_at    timestamptz not null,
  person_id      uuid references public.people (id) on delete set null,
  submission_id  uuid references public.submissions (id) on delete set null,
  matched_by     text check (matched_by in ('thread', 'sender', 'manual')),
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (uid_validity, uid)
);

create index mailbox_messages_person_idx on public.mailbox_messages (person_id, received_at desc);
create index mailbox_messages_from_idx on public.mailbox_messages (from_email, received_at desc);
create index mailbox_messages_unread_idx on public.mailbox_messages (received_at desc) where read_at is null;

-- Threading for outgoing emails
alter table public.email_log
  add column person_id   uuid references public.people (id) on delete set null,
  add column in_reply_to text,
  add column references_ids text[] not null default '{}';

-- Existing rows: person from the submission
update public.email_log l set person_id = s.person_id
from public.submissions s where s.id = l.submission_id and l.person_id is null;

-- Keep person_id filled for emails queued by the database functions
create or replace function public.fill_email_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.person_id is null and new.submission_id is not null then
    select person_id into new.person_id from public.submissions where id = new.submission_id;
  end if;
  return new;
end;
$$;

create trigger email_log_fill_person before insert on public.email_log
  for each row execute function public.fill_email_person();

revoke execute on function public.fill_email_person() from public, anon, authenticated;

-- Access: team only
alter table public.mailbox_messages enable row level security;
alter table public.mailbox_state enable row level security;
revoke all on table public.mailbox_messages, public.mailbox_state from anon;

create policy "team full access" on public.mailbox_messages
  for all to authenticated using ((select public.is_team())) with check ((select public.is_team()));
create policy "team reads sync state" on public.mailbox_state
  for select to authenticated using ((select public.is_team()));
create policy "team edits sync state" on public.mailbox_state
  for update to authenticated using ((select public.is_team())) with check ((select public.is_team()));

-- Sync every 2 minutes
select cron.schedule(
  'sync-mailbox',
  '*/2 * * * *',
  $$ select net.http_post(
       url     := 'https://wenkvkkfmclhycyxnxxu.supabase.co/functions/v1/sync-mailbox',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body    := '{}'::jsonb
     ) $$
);
