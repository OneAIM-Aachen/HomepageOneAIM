-- Addresses of the website areas for links in emails (docs/deployment.md):
--   team_url    team area      (team.one-aim.org)    invites, password links, yearly check
--   apply_url   applications   (apply.one-aim.org)   booking and feedback links
--   network_url network site   (network.one-aim.org) welcome / password links
-- Empty = one address with paths: apply_base_url + "/" (team),
-- apply_base_url + "/apply", apply_base_url + "/network".

alter table public.email_settings
  add column team_url    text check (team_url    ~ '^https?://'),
  add column apply_url   text check (apply_url   ~ '^https?://'),
  add column network_url text check (network_url ~ '^https?://');
