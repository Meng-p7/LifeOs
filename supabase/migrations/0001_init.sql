-- LifeOS 0001：表结构（与前端数据模型 v2 一一对应）
-- 在 Supabase SQL Editor 中执行；然后再执行 0002_rls.sql

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  subject_id text,
  due date,
  priority text not null default 'normal',
  est_min integer not null default 0,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.study_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id text,
  task_id text,
  date date not null,
  start_time text,
  minutes integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.fitness_days (
  date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  checks jsonb not null default '{}',
  note text not null default '',
  rpe text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.weight_entries (
  date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kg numeric(5,1) not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.diet_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal text not null default '',
  food text not null default '',
  kcal integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.blocks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  type text not null default 'other',
  date date not null,
  start time not null,
  "end" time not null,
  task_id text,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.reviews (
  key text not null,            -- 'YYYY-MM-DD'（日复盘）或 'W2026-42'（周复盘）
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- 同步查询常用索引
create index if not exists idx_tasks_user_updated   on public.tasks(user_id, updated_at);
create index if not exists idx_study_user_updated   on public.study_records(user_id, updated_at);
create index if not exists idx_blocks_user_date     on public.blocks(user_id, date);
create index if not exists idx_diet_user_date       on public.diet_entries(user_id, date);
