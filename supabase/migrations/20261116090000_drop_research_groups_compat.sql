-- The deployed team portal no longer reads research_groups (free text since 20261115160000);
-- removes the temporary empty table from 20261115170000.
drop table if exists public.research_groups;
