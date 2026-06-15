-- ============================================================================
-- 006_fiscal_schema_baseline.sql
-- ----------------------------------------------------------------------------
-- BASELINE FISCAL — Fuente de verdad en el repo del esquema fiscal de RP.
--
-- OBJETIVO DOBLE:
--   1. Ejecutable contra PROD sin cambiar absolutamente nada (100% idempotente:
--      CREATE TABLE IF NOT EXISTS + ALTER ... ADD COLUMN IF NOT EXISTS + DO blocks).
--   2. Capaz de reconstruir una BD limpia desde cero con el esquema fiscal real.
--
-- Refleja EXACTAMENTE el esquema introspectado de prod (information_schema.columns)
-- de: tickets, payments, turnos_caja y los campos fiscales de restaurants.
-- Tipos, precision y scale son los reales (numeric(10,2), varchar, etc.).
--
-- NOTA sobre DEFAULTs: information_schema no nos dio column_default. Las columnas
-- NOT NULL que el INSERT del TPV no envía (verifactu_status, discount_amount,
-- is_copy) tienen un DEFAULT en prod que aquí reproducimos con el valor más
-- razonable. Como contra prod esto es no-op (la tabla ya existe), solo afecta a
-- la reconstrucción desde cero. Verificar el DEFAULT real de verifactu_status
-- antes de confiar en un rebuild limpio (ver "Anotado para después").
--
-- Dependencias para un rebuild desde cero: requiere que existan ya las tablas
-- restaurants, orders y users (creadas por migraciones/baseline anteriores),
-- por las claves foráneas.
-- ============================================================================


-- ============================================================================
-- TABLA: tickets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id                   uuid           NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id        uuid           NOT NULL,
  order_id             uuid           NOT NULL,
  ticket_number        varchar        NOT NULL,
  series               varchar        NOT NULL,
  sequential_number    integer        NOT NULL,
  issuer_name          varchar        NOT NULL,
  issuer_nif           varchar        NOT NULL,
  issuer_address       text,
  issued_at            timestamptz    NOT NULL DEFAULT now(),
  subtotal             numeric(10,2)  NOT NULL,
  tax_breakdown        jsonb          NOT NULL DEFAULT '[]'::jsonb,
  tax_total            numeric(10,2)  NOT NULL,
  total                numeric(10,2)  NOT NULL,
  discount_amount      numeric(10,2)  NOT NULL DEFAULT 0,
  payment_method       varchar,
  pdf_url              text,
  is_copy              boolean        NOT NULL DEFAULT false,
  verifactu_hash       varchar,
  verifactu_prev_hash  varchar,
  verifactu_status     varchar        NOT NULL DEFAULT 'pending',
  verifactu_sent_at    timestamptz,
  verifactu_response   jsonb,
  created_at           timestamptz    NOT NULL DEFAULT now(),
  anulado              boolean        DEFAULT false,
  anulado_at           timestamptz,
  ticket_anulado_id    uuid,
  motivo_anulacion     text,
  CONSTRAINT tickets_pkey PRIMARY KEY (id)
);

-- ADD COLUMN IF NOT EXISTS por si la tabla ya existía con columnas faltantes
-- (idempotente; no toca columnas existentes).
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS restaurant_id        uuid;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS order_id             uuid;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_number        varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS series               varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sequential_number    integer;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS issuer_name          varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS issuer_nif           varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS issuer_address       text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS issued_at            timestamptz DEFAULT now();
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS subtotal             numeric(10,2);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS tax_breakdown        jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS tax_total            numeric(10,2);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS total                numeric(10,2);
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS discount_amount      numeric(10,2) DEFAULT 0;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS payment_method       varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS pdf_url              text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_copy              boolean DEFAULT false;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS verifactu_hash       varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS verifactu_prev_hash  varchar;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS verifactu_status     varchar DEFAULT 'pending';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS verifactu_sent_at    timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS verifactu_response   jsonb;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS created_at           timestamptz DEFAULT now();
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS anulado              boolean DEFAULT false;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS anulado_at           timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_anulado_id    uuid;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS motivo_anulacion     text;

-- Claves foráneas (idempotentes vía DO block / catálogo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_restaurant_id_fkey') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_order_id_fkey') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id);
  END IF;

  -- Auto-referencia: un ticket de anulación apunta al ticket anulado.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_ticket_anulado_id_fkey') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_ticket_anulado_id_fkey
      FOREIGN KEY (ticket_anulado_id) REFERENCES public.tickets(id);
  END IF;
END
$$;

-- UNIQUE (restaurant_id, series, sequential_number): garantiza numeración
-- correlativa única por restaurante y serie. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_restaurant_series_seq_unique') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_restaurant_series_seq_unique
      UNIQUE (restaurant_id, series, sequential_number);
  END IF;
END
$$;


-- ============================================================================
-- TABLA: payments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id             uuid           NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id  uuid           NOT NULL,
  ticket_id      uuid           NOT NULL,
  method         varchar        NOT NULL,
  amount         numeric(10,2)  NOT NULL,
  change_given   numeric(10,2)  NOT NULL DEFAULT 0,
  reference      varchar,
  processed_by   uuid,
  processed_at   timestamptz    NOT NULL DEFAULT now(),
  notes          text,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS restaurant_id  uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS ticket_id      uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method         varchar;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount         numeric(10,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS change_given   numeric(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference      varchar;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS processed_by   uuid;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS processed_at   timestamptz DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes          text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_restaurant_id_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_ticket_id_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_processed_by_fkey') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_processed_by_fkey
      FOREIGN KEY (processed_by) REFERENCES public.users(id);
  END IF;
END
$$;


-- ============================================================================
-- TABLA: turnos_caja
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.turnos_caja (
  id                 uuid           NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id      uuid           NOT NULL,
  abierto_por        uuid           NOT NULL,
  cerrado_por        uuid,
  fondo_inicial      numeric(10,2)  NOT NULL DEFAULT 0,
  fecha_apertura     timestamptz    NOT NULL DEFAULT now(),
  fecha_cierre       timestamptz,
  efectivo_esperado  numeric(10,2),
  efectivo_contado   numeric(10,2),
  descuadre          numeric(10,2),
  total_ventas       numeric(10,2),
  total_efectivo     numeric(10,2),
  total_tarjeta      numeric(10,2),
  total_tickets      integer,
  notas              text,
  estado             text           NOT NULL DEFAULT 'abierto',
  created_at         timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT turnos_caja_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_caja_estado_check CHECK (estado IN ('abierto', 'cerrado'))
);

ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS restaurant_id      uuid;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS abierto_por        uuid;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS cerrado_por        uuid;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS fondo_inicial      numeric(10,2) DEFAULT 0;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS fecha_apertura     timestamptz DEFAULT now();
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS fecha_cierre       timestamptz;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS efectivo_esperado  numeric(10,2);
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS efectivo_contado   numeric(10,2);
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS descuadre          numeric(10,2);
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS total_ventas       numeric(10,2);
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS total_efectivo     numeric(10,2);
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS total_tarjeta      numeric(10,2);
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS total_tickets      integer;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS notas              text;
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS estado             text DEFAULT 'abierto';
ALTER TABLE public.turnos_caja ADD COLUMN IF NOT EXISTS created_at         timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turnos_caja_restaurant_id_fkey') THEN
    ALTER TABLE public.turnos_caja
      ADD CONSTRAINT turnos_caja_restaurant_id_fkey
      FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turnos_caja_abierto_por_fkey') THEN
    ALTER TABLE public.turnos_caja
      ADD CONSTRAINT turnos_caja_abierto_por_fkey
      FOREIGN KEY (abierto_por) REFERENCES public.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turnos_caja_cerrado_por_fkey') THEN
    ALTER TABLE public.turnos_caja
      ADD CONSTRAINT turnos_caja_cerrado_por_fkey
      FOREIGN KEY (cerrado_por) REFERENCES public.users(id);
  END IF;
END
$$;


-- ============================================================================
-- restaurants: SOLO campos fiscales Verifactu (resto de la tabla vive en su
-- baseline propio). Idempotente. verifacti_api_key es config MUTABLE (rotación
-- de clave), por eso queda fuera de los triggers de inmutabilidad de 007.
-- ============================================================================
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS verifactu_enabled      boolean NOT NULL DEFAULT false;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS verifactu_serie        varchar NOT NULL DEFAULT 'A';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS verifactu_last_number  integer NOT NULL DEFAULT 0;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS verifacti_api_key      text;


-- ============================================================================
-- FUNCIÓN: get_next_ticket_number
-- Reproducción IDÉNTICA de la definición real en prod (no modificar: es la
-- numeración fiscal correlativa). Incrementa atómicamente el contador del
-- restaurante y devuelve el nuevo número.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_next_ticket_number(p_restaurant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  next_number INTEGER;
BEGIN
  UPDATE restaurants
  SET verifactu_last_number = verifactu_last_number + 1
  WHERE id = p_restaurant_id
  RETURNING verifactu_last_number INTO next_number;

  RETURN next_number;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_next_ticket_number(uuid) TO authenticated, service_role;
