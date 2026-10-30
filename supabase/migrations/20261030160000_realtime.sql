-- Live updates in the team portal: the browser is told when these tables
-- change (Supabase Realtime) and reloads its data. Row level security still
-- applies – only signed-in team members receive changes.
alter publication supabase_realtime add table
  public.applications, public.interview_slots, public.submissions, public.submission_scores,
  public.submission_reviewers, public.submission_comments, public.people, public.email_log,
  public.mailbox_messages, public.team_members, public.team_departments, public.network_posts,
  public.blueprints, public.scorecards;
