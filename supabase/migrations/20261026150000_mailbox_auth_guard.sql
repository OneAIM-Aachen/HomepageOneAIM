-- After a rejected IMAP login the sync stops trying (to avoid Strato locking
-- the mailbox) until different credentials are stored. Only a hash is kept.
alter table public.mailbox_state add column failed_credentials_hash text;
