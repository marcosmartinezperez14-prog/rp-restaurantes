-- Páginas legales (RGPD) para la zona pública /cliente/[slug] y registro de
-- consentimiento en las reservas. Re-ejecutable (IF EXISTS / IF NOT EXISTS).

-- ───────────────────────────────────────────────────────────────────────────
-- 1) Textos legales por restaurante (multi-tenant)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.legal_pages (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tipo          text not null check (tipo in ('privacidad','aviso_legal','cookies')),
  contenido     text not null default '',
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, tipo)
);

create index if not exists idx_legal_pages_restaurant
  on public.legal_pages (restaurant_id);

alter table public.legal_pages enable row level security;

-- Escritura/gestión desde el dashboard, acotada al tenant de la sesión.
drop policy if exists "legal_pages_owner" on public.legal_pages;
create policy "legal_pages_owner" on public.legal_pages
  for all
  using (restaurant_id = get_current_restaurant_id())
  with check (restaurant_id = get_current_restaurant_id());

-- Lectura pública: los textos legales son, por su naturaleza, públicos. Se
-- limitan EXCLUSIVAMENTE a esta tabla (no se abre lectura a otras tablas del
-- tenant). La resolución slug -> restaurant_id se hace en el servidor.
drop policy if exists "legal_pages_public_read" on public.legal_pages;
create policy "legal_pages_public_read" on public.legal_pages
  for select
  to anon, authenticated
  using (true);

-- ───────────────────────────────────────────────────────────────────────────
-- 2) Consentimiento RGPD en las reservas (tabla real: reservations)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.reservations
  add column if not exists consentimiento_rgpd boolean not null default false;

alter table public.reservations
  add column if not exists consentimiento_timestamp timestamptz null;

alter table public.reservations
  add column if not exists consentimiento_texto_version text null;
