-- Diet Tracker schema for Supabase
-- Run in Supabase SQL Editor before enabling useSupabase in environment files.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  calorie_target integer not null default 2000,
  protein_target integer not null default 150,
  carbs_target integer not null default 200,
  fat_target integer not null default 65,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  brand text,
  calories numeric(10, 2) not null default 0,
  protein numeric(10, 2) not null default 0,
  carbs numeric(10, 2) not null default 0,
  fat numeric(10, 2) not null default 0,
  serving_qty numeric(10, 2) not null default 1,
  serving_unit text not null default 'serving',
  barcode text,
  source text not null default 'manual' check (source in ('manual', 'openfoodfacts', 'barcode')),
  created_at timestamptz not null default now()
);

create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, logged_date desc);

alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "food_entries_select_own"
  on public.food_entries for select
  using (auth.uid() = user_id);

create policy "food_entries_insert_own"
  on public.food_entries for insert
  with check (auth.uid() = user_id);

create policy "food_entries_update_own"
  on public.food_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "food_entries_delete_own"
  on public.food_entries for delete
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
