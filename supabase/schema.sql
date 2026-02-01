-- Resume AI Chatbot — Phase 1 schema
-- Run this in Supabase SQL Editor to create tables.

-- Enable UUID extension if not already
create extension if not exists "uuid-ossp";

-- Profiles (one per user): bio, current job role, career summary, skills
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bio text,
  current_job_role text,
  career_summary text,
  skills text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Work experience
create table if not exists public.work_experience (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role text not null,
  start_date text,
  end_date text,
  responsibilities text[] default '{}',
  achievements text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  impact text,
  technologies text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sessions (one per chat session)
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz default now(),
  end_time timestamptz,
  summary text,
  status text not null default 'active' check (status in ('active', 'ended')),
  life_story_mode boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conversation messages
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz default now()
);

-- Indexes for common lookups
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_work_experience_user_id on public.work_experience(user_id);
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_conversations_session_id on public.conversations(session_id);

-- RLS: enable and policy so users only see their own data
alter table public.profiles enable row level security;
alter table public.work_experience enable row level security;
alter table public.projects enable row level security;
alter table public.sessions enable row level security;
alter table public.conversations enable row level security;

create policy "Users can manage own profile"
  on public.profiles for all using (auth.uid() = user_id);

create policy "Users can manage own work_experience"
  on public.work_experience for all using (auth.uid() = user_id);

create policy "Users can manage own projects"
  on public.projects for all using (auth.uid() = user_id);

create policy "Users can manage own sessions"
  on public.sessions for all using (auth.uid() = user_id);

create policy "Users can manage conversations for own sessions"
  on public.conversations for all using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Optional: updated_at trigger (reuse for all tables if desired)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger work_experience_updated_at before update on public.work_experience
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
