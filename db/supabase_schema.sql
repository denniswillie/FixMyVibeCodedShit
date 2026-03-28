create extension if not exists pgcrypto;

create table if not exists public.users (
  id bigserial primary key,
  email text not null,
  full_name text,
  avatar_url text,
  google_subject text,
  last_login_provider text,
  email_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint users_last_login_provider_check
    check (last_login_provider is null or last_login_provider in ('google'))
);

create unique index if not exists users_email_lower_idx
  on public.users (lower(email));

create unique index if not exists users_google_subject_idx
  on public.users (google_subject)
  where google_subject is not null;

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.users(id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists auth_sessions_token_hash_idx
  on public.auth_sessions (session_token_hash);

create index if not exists auth_sessions_user_expires_idx
  on public.auth_sessions (user_id, expires_at desc);

create index if not exists auth_sessions_active_idx
  on public.auth_sessions (expires_at desc)
  where revoked_at is null;

create table if not exists public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null unique references public.users(id) on delete cascade,
  github_repo_url text not null default '',
  github_branch text not null default 'main',
  github_access_token text not null default '',
  github_installation_id bigint,
  github_installation_account_login text not null default '',
  github_installation_target_type text not null default '',
  github_repository_selection text not null default '',
  github_repo_count integer not null default 0,
  github_connected_at timestamptz,
  ec2_host text not null default '',
  ec2_port integer not null default 22,
  ec2_username text not null default '',
  ec2_private_key text not null default '',
  docker_service text not null default '',
  log_tail integer not null default 200,
  check_every_minutes integer not null default 15,
  timezone text not null default 'UTC',
  status text not null default 'draft',
  last_triaged_at timestamptz,
  next_triage_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agent_configs_ec2_port_check
    check (ec2_port between 1 and 65535),
  constraint agent_configs_log_tail_check
    check (log_tail >= 1),
  constraint agent_configs_check_every_minutes_check
    check (check_every_minutes >= 1),
  constraint agent_configs_status_check
    check (status in ('draft', 'active', 'paused'))
);

create index if not exists agent_configs_status_next_triage_idx
  on public.agent_configs (status, next_triage_at asc nulls first);

create index if not exists agent_configs_user_updated_idx
  on public.agent_configs (user_id, updated_at desc);

alter table if exists public.agent_configs
  add column if not exists github_installation_id bigint;

alter table if exists public.agent_configs
  add column if not exists github_installation_account_login text not null default '';

alter table if exists public.agent_configs
  add column if not exists github_installation_target_type text not null default '';

alter table if exists public.agent_configs
  add column if not exists github_repository_selection text not null default '';

alter table if exists public.agent_configs
  add column if not exists github_repo_count integer not null default 0;

alter table if exists public.agent_configs
  add column if not exists github_connected_at timestamptz;

create index if not exists agent_configs_github_installation_idx
  on public.agent_configs (github_installation_id)
  where github_installation_id is not null;
