-- Expanded food logging: micros, custom foods, favorites, meal templates
-- Run after 001_schema.sql and 002_weight_entries.sql

alter table public.food_entries
  add column if not exists fiber numeric(10, 2) not null default 0,
  add column if not exists sodium numeric(10, 2) not null default 0,
  add column if not exists sugar numeric(10, 2) not null default 0;

alter table public.food_entries drop constraint if exists food_entries_source_check;
alter table public.food_entries
  add constraint food_entries_source_check
  check (source in (
    'manual', 'openfoodfacts', 'barcode', 'quick', 'custom',
    'favorite', 'template', 'usda', 'indian', 'copy'
  ));

create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  calories numeric(10, 2) not null default 0,
  protein numeric(10, 2) not null default 0,
  carbs numeric(10, 2) not null default 0,
  fat numeric(10, 2) not null default 0,
  fiber numeric(10, 2) not null default 0,
  sodium numeric(10, 2) not null default 0,
  sugar numeric(10, 2) not null default 0,
  serving_qty numeric(10, 2) not null default 1,
  serving_unit text not null default 'serving',
  created_at timestamptz not null default now()
);

create table if not exists public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists custom_foods_user_idx on public.custom_foods (user_id);
create index if not exists favorite_foods_user_idx on public.favorite_foods (user_id);
create index if not exists meal_templates_user_idx on public.meal_templates (user_id);

alter table public.custom_foods enable row level security;
alter table public.favorite_foods enable row level security;
alter table public.meal_templates enable row level security;

create policy "custom_foods_all_own" on public.custom_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "favorite_foods_all_own" on public.favorite_foods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meal_templates_all_own" on public.meal_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
