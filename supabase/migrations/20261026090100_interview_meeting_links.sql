-- ============================================================================
-- Interview meeting links
-- • interview_slots.meeting_link: Zoom/Teams/Meet link of a slot.
--   Never returned by get_booking(): applicants see date, time and place
--   when choosing, the link only arrives by email ("interview_booked").
-- • book_slot() queues the "interview_booked" email after a (re)booking.
-- • send_interview_details(): team re-sends that email, e.g. after the
--   link changed.
-- ============================================================================

alter table public.interview_slots
  add column meeting_link text check (meeting_link is null or meeting_link ~ '^https://');

create or replace function public.book_slot(p_token uuid, p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    public.submissions;
  v_slot   public.interview_slots;
  v_taken  int;
  v_person public.people;
begin
  select * into v_sub from public.submissions where booking_token = p_token for update;
  if not found then raise exception 'invalid_token'; end if;
  if v_sub.status <> 'invited' then raise exception 'not_invited'; end if;

  -- Lock the slot so two people can't take the last seat at the same time
  select * into v_slot from public.interview_slots
  where id = p_slot_id and application_id = v_sub.application_id
  for update;
  if not found then raise exception 'invalid_slot'; end if;
  if v_slot.starts_at <= now() then raise exception 'slot_in_past'; end if;

  select count(*) into v_taken from public.submissions where slot_id = p_slot_id and id <> v_sub.id;
  if v_taken >= v_slot.capacity then raise exception 'slot_full'; end if;

  if v_sub.slot_id is distinct from p_slot_id then
    update public.submissions set slot_id = p_slot_id where id = v_sub.id;

    select * into v_person from public.people where id = v_sub.person_id;
    insert into public.email_log (application_id, submission_id, template, to_email, to_name, queued_by)
    values (v_sub.application_id, v_sub.id, 'interview_booked', v_person.email, v_person.name, 'Applicant');
  end if;
end;
$$;

create or replace function public.send_interview_details(p_submission_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sub    record;
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;

  select su.id, su.application_id, su.slot_id, pe.email, pe.name
    into v_sub
  from public.submissions su
  join public.people pe on pe.id = su.person_id
  where su.id = p_submission_id;

  if not found then raise exception 'invalid_submission'; end if;
  if v_sub.slot_id is null then raise exception 'no_slot_booked'; end if;

  insert into public.email_log (application_id, submission_id, template, to_email, to_name, queued_by)
  values (v_sub.application_id, v_sub.id, 'interview_booked', v_sub.email, v_sub.name, coalesce(public.team_city(), 'Team'));
end;
$$;

revoke execute on function public.send_interview_details(uuid) from public, anon;
grant execute on function public.send_interview_details(uuid) to authenticated;

-- ── Slot mode + completeness ────────────────────────────────────────────────
-- online    → needs a meeting link
-- in_person → needs a place
alter table public.interview_slots
  add column mode text not null default 'online' check (mode in ('online', 'in_person'));

create or replace function public.slot_complete(s public.interview_slots)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case s.mode
    when 'online'    then s.meeting_link is not null
    when 'in_person' then length(trim(s.location)) > 0
    else false
  end;
$$;

-- Why an application can't invite yet (null = ready)
create or replace function public.invite_blocker(p_application_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.interview_slots s
      where s.application_id = p_application_id and s.starts_at > now()
        and s.capacity > (select count(*) from public.submissions x where x.slot_id = s.id)
    ) then 'no_free_slots'
    when exists (
      select 1 from public.interview_slots s
      where s.application_id = p_application_id and s.starts_at > now() and not public.slot_complete(s)
    ) then 'slots_incomplete'
    else null
  end;
$$;

-- decide(): same as before, plus: no invitations while slots are missing
-- or incomplete (raises, so nothing is changed and no email goes out).
create or replace function public.decide(p_submission_ids uuid[], p_decision text, p_send_email boolean default true)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sub      record;
  v_new      public.submission_status;
  v_template public.email_template;
  v_count    int := 0;
  v_app      uuid;
  v_blocker  text;
begin
  if not public.is_team() then raise exception 'not_allowed'; end if;
  if p_decision not in ('invite', 'accept', 'reject', 'reset') then raise exception 'invalid_decision'; end if;

  if p_decision = 'invite' then
    for v_app in
      select distinct application_id from public.submissions where id = any (p_submission_ids)
    loop
      v_blocker := public.invite_blocker(v_app);
      if v_blocker is not null then raise exception '%', v_blocker; end if;
    end loop;
  end if;

  for v_sub in
    select su.id, su.status, su.application_id, a.pipeline, pe.email, pe.name
    from public.submissions su
    join public.applications a on a.id = su.application_id
    join public.people pe on pe.id = su.person_id
    where su.id = any (p_submission_ids)
    for update of su
  loop
    v_new := null;
    v_template := null;

    if p_decision = 'invite' and v_sub.pipeline = 'interview' and v_sub.status = 'new' then
      v_new := 'invited'; v_template := 'invite';
    elsif p_decision = 'accept' and ((v_sub.pipeline = 'screening' and v_sub.status = 'new')
                                  or (v_sub.pipeline = 'interview' and v_sub.status = 'invited')) then
      v_new := 'accepted'; v_template := 'acceptance';
    elsif p_decision = 'reject' and v_sub.pipeline <> 'instant' and v_sub.status in ('new', 'invited') then
      v_new := 'rejected'; v_template := 'rejection';
    elsif p_decision = 'reset' and v_sub.pipeline <> 'instant' and v_sub.status <> 'new' then
      v_new := 'new';
    end if;

    continue when v_new is null;

    update public.submissions
       set status = v_new,
           slot_id = case when v_new = 'new' then null else slot_id end
     where id = v_sub.id;

    if p_send_email and v_template is not null then
      insert into public.email_log (application_id, submission_id, template, to_email, to_name, queued_by)
      values (v_sub.application_id, v_sub.id, v_template, v_sub.email, v_sub.name, coalesce(public.team_city(), 'Team'));
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Booking only into complete slots
create or replace function public.check_slot_bookable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slot_id is not null and new.slot_id is distinct from old.slot_id and exists (
    select 1 from public.interview_slots s where s.id = new.slot_id and not public.slot_complete(s)
  ) then
    raise exception 'slot_incomplete';
  end if;
  return new;
end;
$$;

create trigger submissions_slot_bookable before update of slot_id on public.submissions
  for each row execute function public.check_slot_bookable();

revoke execute on function public.decide(uuid[], text, boolean) from public, anon;
grant execute on function public.decide(uuid[], text, boolean) to authenticated;
revoke execute on function public.invite_blocker(uuid), public.slot_complete(public.interview_slots) from public, anon;
grant execute on function public.invite_blocker(uuid) to authenticated;
revoke execute on function public.check_slot_bookable() from public, anon, authenticated;

-- Booking page: only complete slots (and still never the meeting link)
create or replace function public.get_booking(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name',  split_part(pe.name, ' ', 1),
    'application', coalesce(a.title, p.name || ' ' || l.name || ' – ' || s.label),
    'status',      su.status,
    'slot_id',     su.slot_id,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sl.id, 'starts_at', sl.starts_at, 'duration_min', sl.duration_min,
               'location', sl.location,
               'available', sl.capacity - (select count(*) from public.submissions x where x.slot_id = sl.id and x.id <> su.id) > 0)
             order by sl.starts_at)
      from public.interview_slots sl
      where sl.application_id = a.id and sl.starts_at > now() and public.slot_complete(sl)
    ), '[]'::jsonb)
  )
  from public.submissions su
  join public.people pe     on pe.id = su.person_id
  join public.applications a on a.id = su.application_id
  join public.programs  p   on p.id = a.program_id
  join public.locations l   on l.id = a.location_id
  join public.semesters s   on s.id = a.semester_id
  where su.booking_token = p_token;
$$;
