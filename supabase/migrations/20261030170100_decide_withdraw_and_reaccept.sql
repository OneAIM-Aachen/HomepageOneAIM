-- decide(): two more transitions
--   withdraw: accepted → "accepted, could not attend" (no email)
--   accept:   also from rejected (move up, e.g. from the waiting list) and back
--             from "could not attend" – sends the acceptance email as usual
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
  if p_decision not in ('invite', 'accept', 'reject', 'reset', 'withdraw') then raise exception 'invalid_decision'; end if;

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
                                  or (v_sub.pipeline = 'interview' and v_sub.status = 'invited')
                                  -- moving up from the rejected (e.g. waiting list) or back after dropping out
                                  or (v_sub.pipeline <> 'instant' and v_sub.status::text in ('rejected', 'withdrawn'))) then
      v_new := 'accepted'; v_template := 'acceptance';
    elsif p_decision = 'withdraw' and v_sub.status = 'accepted' then
      v_new := 'withdrawn';   -- accepted, could not attend: no email
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
