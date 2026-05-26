alter table sender_drafts add column if not exists send_mode text;
alter table instruction_packages add column if not exists sender_id uuid references profiles(id);
alter table instruction_packages add column if not exists send_mode text default 'interview';

alter table package_questions add column if not exists sender_id uuid references profiles(id);
alter table package_questions add column if not exists task_id uuid references tasks(id);

create table if not exists domain_learnings (
  id text primary key default gen_random_uuid()::text,
  sender_id uuid references profiles(id) on delete cascade not null,
  domain text not null,
  question text not null,
  answer text not null,
  times_applied integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_id, domain, question)
);

create index if not exists idx_domain_learnings_sender on domain_learnings(sender_id, domain);

alter table domain_learnings enable row level security;
create policy "domain_learnings service role" on domain_learnings for all using (true);

alter publication supabase_realtime add table package_questions;
