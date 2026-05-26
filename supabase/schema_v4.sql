alter table domain_learnings
  add column if not exists search_text text,
  add column if not exists embedding jsonb;
