-- New status: accepted, but could not attend (dropped out). Frees the spot;
-- not counted as a participant.
alter type public.submission_status add value if not exists 'withdrawn';
