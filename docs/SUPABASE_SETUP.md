# LifeOS 云同步部署指南（Supabase）

> 状态：**代码已接入，待两步手动操作**：① 在 Supabase 执行建表 SQL（下方第 3 节）；② 在 App「设置 → 云同步」填写项目地址和 Publishable Key。
> 完成前，应用顶栏同步芯片如实显示「本地模式」，所有核心功能在本地完整可用，不会假装同步成功。

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

## 4. 在 App 中填写配置（约 1 分钟）

代码侧已内置 `SupabaseAdapter`（`src/js/supabase-adapter.js`），无需改代码，两种填写方式任选：

**方式 A：设置页填写（推荐）**
打开 LifeOS → 顶栏齿轮进入「设置」→「云同步」卡片 → 填写 Supabase 项目地址和 Publishable Key → 「保存并连接」。

**方式 B：URL 参数一次性注入（适合手机端）**
在电脑浏览器打开下面这个链接（把两处换成你的值），按提示登录后，手机端发一条同样的链接给自己、点开即完成配置（注入后地址栏自动清除密钥，不会留在历史记录）：

```
https://meng-p7.github.io/LifeOs/?sb_url=https://<项目>.supabase.co&sb_key=<publishable-key>
```

配置保存在本机浏览器。**publishable key 是设计上前端可用的公开客户端密钥**，数据隔离由 RLS 强制；`service_role` key 严禁出现在任何前端代码、链接或 Git 仓库中。

## 5. 登录与合并行为（已实现）

- **注册**：设置 → 云同步 → 邮箱 + 密码 →「注册新账号」。Supabase 默认发送确认邮件，点确认后返回登录。
- **登录后自动同步**：先拉取远端与本地**按记录合并**（`id` + `updatedAt`，较新者胜），再把合并结果推回云端。
  - 本地有数据、云端为空 → 本地数据上传，不会被空云端覆盖；
  - 云端有、本地空 → 落地；
  - 两边都有 → 逐条合并，冲突不静默丢数据。
- **删除墓碑**：本地删除的记录以 `deleted=true` 参与同步，避免 A 设备删除后又被 B 设备同步回来。
- **自动上传**：本地改动停止操作约 1 秒后自动推送；顶栏芯片实时显示 本地模式 / 未登录 / 同步中 / 已同步 / 待同步 / 离线 / 同步失败，点击芯片可重试。
- **会话保持**：access_token 过期前自动用 refresh_token 续期；刷新页面不断登录状态。

## 6. 无配置/异常环境的安全降级

- 未注入环境变量时：`Sync.adapter = null`，状态恒为「本地模式」，顶栏芯片可点击并提示前往本指南。
- 网络断开：状态切「离线」，本地保存不受影响，恢复联网后自动重试。
- 同步失败：状态切「同步失败」，芯片可点击重试；**任何同步失败都不删除或回滚本地数据**。

## 7. 验收清单（配置完成后逐项确认）

- [ ] 未登录时可正常使用全部本地功能
- [ ] 注册 / 登录 / 退出 / 刷新后会话恢复
- [ ] A 设备新增任务，B 设备刷新后可见
- [ ] 本地有数据时首次登录不被空云端覆盖
- [ ] 同一记录重复同步不产生重复
- [ ] 删除后不会因另一台设备同步而复活
- [ ] RLS 生效（用另一个账号登录看不到前一个账号的数据）
- [ ] 前端代码与 Git 历史中不存在 service_role key
