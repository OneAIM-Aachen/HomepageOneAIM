-- New email type: confirmation after an applicant booked an interview slot.
-- (Own migration: a new enum value can't be used in the same transaction.)
alter type public.email_template add value if not exists 'interview_booked';
