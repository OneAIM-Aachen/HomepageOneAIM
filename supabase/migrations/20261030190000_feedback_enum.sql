-- New email kind: link to the participant feedback form.
-- Separate migration: a new enum value can't be used in the same transaction.
alter type public.email_template add value if not exists 'feedback';
