-- Weight tracking for FuelLog analytics
-- Run in Supabase SQL Editor when enabling cloud mode.

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_date date not null,
  weight_kg numeric(6, 2) not null check (weight_kg > 0 and weight_kg <= 500),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists weight_entries_user_date_idx
  on public.weight_entries (user_id, logged_date desc);

alter table public.weight_entries enable row level security;

create policy "weight_entries_select_own"
  on public.weight_entries for select
  using (auth.uid() = user_id);

create policy "weight_entries_insert_own"
  on public.weight_entries for insert
  with check (auth.uid() = user_id);

create policy "weight_entries_update_own"
  on public.weight_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "weight_entries_delete_own"
  on public.weight_entries for delete
  using (auth.uid() = user_id);
