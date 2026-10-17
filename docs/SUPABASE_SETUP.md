# LifeOS 云同步部署指南（Supabase）

> 状态：**待配置**。当前 `index.html` 未连接任何云端，顶栏同步芯片如实显示「本地模式」。
> 按本文件完成部署后，即可实现 Windows 电脑与 iPhone 之间的数据同步。
> 在完成之前，应用不会假装同步成功；所有核心功能（任务、计时、记录、统计、复盘）在本地模式下完整可用。

## 1. 为什么是 Supabase

LifeOS 是纯静态单文件应用（GitHub Pages 托管），没有自建后端。Supabase 提供：

- **PostgreSQL**：保存结构化数据（任务、学习记录、训练、体重、日程、复盘）。
- **Supabase Auth**：邮箱注册/登录，管理会话。
- **Row Level Security（RLS）**：每条数据带 `user_id`，用户只能读写自己的数据，隔离由数据库策略强制保证。
- 免费额度足够个人使用。

## 2. 创建项目

1. 登录 [supabase.com](https://supabase.com) → New Project。
2. 记录两项信息（只需这两项，**均为可公开的客户端凭据**）：
   - Project URL：`https://<project-ref>.supabase.co`
   - anon public key：`eyJ...`（Settings → API）
3. **严禁**把 `service_role` key 放到任何前端代码或 Git 仓库中。该 key 只允许出现在服务端环境变量里。

## 3. 数据库 Schema

在 Supabase 控制台 SQL Editor 中依次执行 `supabase/migrations/0001_init.sql` 与 `0002_rls.sql`（见仓库 `supabase/migrations/` 目录），或直接粘贴以下内容：

```sql
-- 0001_init.sql：表结构（与前端数据模型 v2 一一对应）
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
  end time not null,
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
```

```sql
-- 0002_rls.sql：行级安全策略（用户只能访问自己的数据）
alter table public.tasks        enable row level security;
alter table public.study_records enable row level security;
alter table public.fitness_days  enable row level security;
alter table public.weight_entries enable row level security;
alter table public.diet_entries  enable row level security;
alter table public.blocks        enable row level security;
alter table public.reviews       enable row level security;
alter table public.user_settings enable row level security;

create policy "own tasks"        on public.tasks        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own study"        on public.study_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own fitness"      on public.fitness_days  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weight"       on public.weight_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own diet"         on public.diet_entries  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own blocks"       on public.blocks        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reviews"      on public.reviews       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings"     on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 4. 环境变量（前端可公开的两项）

部署到 GitHub Pages 时，在仓库 **Settings → Secrets and variables → Actions → Variables** 中配置（或 Pages 构建流程注入）：

```
LIFEOS_SUPABASE_URL=https://<project-ref>.supabase.co
LIFEOS_SUPABASE_ANON_KEY=eyJ...
```

本地开发时可在 `src/js/sync.js` 顶部的读取处临时注入（不要提交真实值）。

## 5. 接入方式（前端同步层已预留接口）

`src/js/sync.js` 已实现同步状态机（本地 / 离线 / 同步中 / 已同步 / 失败 / 待同步）与记录级合并函数 `mergeStates`。接入只需两步：

1. 实现 `CloudAdapter` 接口（接口约定见 `src/js/sync.js` 末尾注释）：`signIn / signUp / signOut / currentUser / push(state) / pull()`。
   - `push`：把本地 `updated_at` 大于远端对应记录的条目 upsert 到上表（软删除记录也要上传，作为墓碑）。
   - `pull`：按 `user_id` 拉取全表，组装为与本地同构的 state 对象，交给 `mergeStates` 合并。
   - 会话恢复：`currentUser()` 命中时自动进入「已登录」并触发一次 pull。
2. 在 `App.init()` 中注入：

```js
if (window.LIFEOS_SUPABASE_URL && window.LIFEOS_SUPABASE_ANON_KEY) {
  Sync.adapter = new SupabaseAdapter({
    url: window.LIFEOS_SUPABASE_URL,
    anonKey: window.LIFEOS_SUPABASE_ANON_KEY
  });
}
```

## 6. 首次登录的数据合并规则（已实现保护）

- 本地有数据、云端为空：登录后首次同步执行**上传合并**（push 优先），不会用空云端覆盖本地。
- 云端有数据、本地为空：pull 后全量落地。
- 两边都有：按记录 `id` + `updatedAt` 逐条合并，较新者胜；冲突不静默丢数据。
- 删除走墓碑（`deleted=true` 记录参与同步），避免 A 设备删除的记录被 B 设备同步回来。

## 7. 无配置环境的安全降级

- 未注入环境变量时：`Sync.adapter = null`，状态恒为「本地模式」，顶栏芯片可点击并提示前往本指南。
- 网络断开：状态切「离线」，本地保存不受影响，恢复联网后自动重试。
- 同步失败：状态切「同步失败」，芯片可点击重试；**任何同步失败都不删除或回滚本地数据**。

## 8. 验收清单（配置完成后逐项确认）

- [ ] 未登录时可正常使用全部本地功能
- [ ] 注册 / 登录 / 退出 / 刷新后会话恢复
- [ ] A 设备新增任务，B 设备刷新后可见
- [ ] 本地有数据时首次登录不被空云端覆盖
- [ ] 同一记录重复同步不产生重复
- [ ] 删除后不会因另一台设备同步而复活
- [ ] RLS 生效（用另一个账号登录看不到前一个账号的数据）
- [ ] 前端代码与 Git 历史中不存在 service_role key
