create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null default '',
  avatar_url text,
  push_subscription jsonb,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "profiles are viewable by authenticated users" on profiles
  for select using (auth.role() = 'authenticated');
create policy "users can update own profile" on profiles
  for update using (auth.uid() = id);
create policy "profiles insertable by service role" on profiles
  for insert with check (true);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  contact_id uuid references profiles(id) on delete cascade not null,
  nickname text,
  task_count integer default 0,
  created_at timestamptz not null default now(),
  unique(user_id, contact_id)
);

create index if not exists idx_contacts_user on contacts(user_id);

alter table contacts enable row level security;
create policy "users can manage own contacts" on contacts
  for all using (auth.uid() = user_id);

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  package_id text references instruction_packages(id) not null,
  sender_id uuid references profiles(id) not null,
  executor_id uuid references profiles(id) not null,
  session_id text,
  status text not null default 'pending',
  current_step integer default 0,
  total_steps integer default 0,
  last_help_question text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_executor on tasks(executor_id, status);
create index if not exists idx_tasks_sender on tasks(sender_id);

alter table tasks enable row level security;
create policy "task participants can view" on tasks
  for select using (auth.uid() = sender_id or auth.uid() = executor_id);
create policy "senders can create tasks" on tasks
  for insert with check (auth.uid() = sender_id);
create policy "participants can update tasks" on tasks
  for update using (auth.uid() = sender_id or auth.uid() = executor_id);

alter publication supabase_realtime add table tasks;
