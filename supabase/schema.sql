-- Control de Gastos — Esquema Supabase, Fase 1 (documento único, mismo formato que localStorage)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
--
-- Decisión: se replica el documento único versionado que ya usa js/core/storage.js
-- (ver docs/decisions.md) en vez de modelar 13 tablas relacionales. Esto permite que
-- StorageService cambie únicamente su transporte (localStorage -> Supabase) sin tocar
-- repositories/services/modules ni la cadena de migraciones (MIGRATIONS[1..5]).

create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- Cada usuario solo puede leer/escribir su propia fila (auth.uid() lo provee Supabase Auth
-- automáticamente en cada request autenticado — no hace falta pasarlo a mano).
create policy "select_own_app_data"
  on public.app_data for select
  using (auth.uid() = user_id);

create policy "insert_own_app_data"
  on public.app_data for insert
  with check (auth.uid() = user_id);

create policy "update_own_app_data"
  on public.app_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete_own_app_data"
  on public.app_data for delete
  using (auth.uid() = user_id);
