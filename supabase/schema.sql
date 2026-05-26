create table if not exists instruction_packages (
  id text primary key,
  share_token text unique not null,
  title text not null,
  description text,
  domain text not null default 'other',
  estimated_minutes integer not null default 10,
  steps jsonb not null default '[]',
  sender_profile jsonb not null default '{}',
  raw_input text,
  created_at timestamptz not null default now()
);

create index if not exists idx_packages_share_token on instruction_packages(share_token);

create table if not exists sender_drafts (
  id text primary key,
  raw_input text,
  parsed_draft jsonb,
  nuance_questions jsonb,
  interview_answers jsonb default '[]',
  status text not null default 'parsing',
  package_id text references instruction_packages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists execution_events (
  id text primary key default gen_random_uuid()::text,
  package_id text references instruction_packages(id),
  session_id text not null,
  event_type text not null,
  step_index integer,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table instruction_packages enable row level security;
create policy "packages are publicly readable" on instruction_packages
  for select using (true);
create policy "packages insertable by service role" on instruction_packages
  for insert with check (true);

alter table sender_drafts enable row level security;
create policy "drafts readable by service role" on sender_drafts
  for all using (true);

alter table execution_events enable row level security;
create policy "events insertable by service role" on execution_events
  for insert with check (true);

create table if not exists package_questions (
  id text primary key default gen_random_uuid()::text,
  package_id text references instruction_packages(id),
  share_token text not null,
  step_index integer,
  question text not null,
  answer text,
  answered_at timestamptz,
  session_count integer default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_pq_share_token on package_questions(share_token);
create index if not exists idx_pq_unanswered on package_questions(share_token, answered_at) where answered_at is null;

alter table package_questions enable row level security;
create policy "package_questions managed by service role" on package_questions
  for all using (true);

create table if not exists execution_sessions (
  id text primary key,
  package_id text references instruction_packages(id),
  share_token text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists idx_sessions_share_token on execution_sessions(share_token);

alter table execution_sessions enable row level security;
create policy "sessions managed by service role" on execution_sessions
  for all using (true);

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict do nothing;
