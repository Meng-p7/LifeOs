-- LifeOS 0002：行级安全策略（用户只能访问自己的数据）
-- 执行前需先执行 0001_init.sql

alter table public.tasks         enable row level security;
alter table public.study_records enable row level security;
alter table public.fitness_days  enable row level security;
alter table public.weight_entries enable row level security;
alter table public.diet_entries  enable row level security;
alter table public.blocks        enable row level security;
alter table public.reviews       enable row level security;
alter table public.user_settings enable row level security;

create policy "own tasks"     on public.tasks         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own study"     on public.study_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own fitness"   on public.fitness_days  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own weight"    on public.weight_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own diet"      on public.diet_entries  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own blocks"    on public.blocks        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reviews"   on public.reviews       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings"  on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
