-- Rate-limit de ventana deslizante en Postgres (#8, #9).
-- Usado por los endpoints públicos (reservas y pedido por QR) que corren con
-- service_role en Vercel serverless, donde no hay estado entre invocaciones.

create table if not exists public.rate_limit_hits (
  id      bigserial primary key,
  bucket  text not null,
  hit_at  timestamptz not null default now()
);

-- Consulta por bucket+ventana y limpieza por bucket usan este índice.
create index if not exists idx_rate_limit_bucket_time
  on public.rate_limit_hits (bucket, hit_at desc);

-- Tabla interna: solo accesible vía la RPC (service_role salta RLS de todos
-- modos; activamos RLS sin políticas para denegar acceso directo de clientes).
alter table public.rate_limit_hits enable row level security;

-- Registra un acceso y devuelve TRUE si está dentro del límite, FALSE si se
-- excede. Ventana deslizante: cuenta los hits del bucket en los últimos
-- p_window_seconds; si está por debajo de p_max, inserta y permite.
create or replace function public.check_rate_limit(
  p_bucket          text,
  p_max             int,
  p_window_seconds  int
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  -- Limpieza acotada a este bucket (usa el índice, sin barrido global).
  delete from public.rate_limit_hits
   where bucket = p_bucket
     and hit_at < now() - (p_window_seconds * interval '1 second');

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket = p_bucket
     and hit_at > now() - (p_window_seconds * interval '1 second');

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket) values (p_bucket);
  return true;
end;
$$;

-- La RPC se llama desde el cliente admin (service_role). Restringimos el resto.
revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
