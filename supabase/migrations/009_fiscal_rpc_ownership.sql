-- ============================================================================
-- 009_fiscal_rpc_ownership.sql
-- ----------------------------------------------------------------------------
-- Endurecimiento de las RPCs fiscales (auditoría de seguridad — Fase 1):
--
--   R3 (#2) — Validación de pertenencia DENTRO de las RPCs: ahora reciben
--             p_restaurant_id y solo operan si el ticket pertenece a ese
--             restaurante. Defensa en profundidad: aunque la ruta valide el
--             ownership, las RPCs (SECURITY DEFINER, saltan RLS) dejan de
--             confiar ciegamente en el caller.
--
--   R4 (#7) — Race condition de la cadena de huellas: claim y persistir toman
--             un advisory lock por restaurante (pg_advisory_xact_lock) para
--             serializar la emisión y que el cálculo de prev_hash no se ramifique
--             bajo concurrencia.
--
--   #12     — Índice de soporte para la consulta de prev_hash.
--
-- CAMBIA LA FIRMA de las 4 funciones (añaden p_restaurant_id) → se hace DROP +
-- CREATE. Los callers (verifactu/enviar, tickets/anular) deben pasar el
-- restaurant_id del usuario autenticado.
--
-- NOTA: el search_path sigue fijado (SET search_path = public, pg_temp).
-- Idempotente: DROP IF EXISTS de la firma antigua + CREATE OR REPLACE.
-- ============================================================================


-- ── Eliminar las firmas antiguas (uuid-only) ────────────────────────────────
DROP FUNCTION IF EXISTS public.fiscal_claim_emision(uuid);
DROP FUNCTION IF EXISTS public.fiscal_persistir_emision(uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS public.fiscal_marcar_error_emision(uuid, text);
DROP FUNCTION IF EXISTS public.fiscal_anular_ticket(uuid, text);


-- ── Índice de soporte para prev_hash (#12) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tickets_prev_hash
  ON public.tickets (restaurant_id, verifactu_sent_at DESC)
  WHERE verifactu_hash IS NOT NULL;


-- ----------------------------------------------------------------------------
-- fiscal_claim_emision(p_ticket_id, p_restaurant_id)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_claim_emision(
  p_ticket_id     uuid,
  p_restaurant_id uuid
)
 RETURNS public.tickets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ticket public.tickets;
BEGIN
  -- Serializa la emisión por restaurante (R4): evita que dos emisiones casi
  -- simultáneas del mismo restaurante ramifiquen la cadena de prev_hash.
  PERFORM pg_advisory_xact_lock(hashtext('fiscal:' || p_restaurant_id::text));

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado en el restaurante: %', p_ticket_id;
  END IF;

  IF v_ticket.verifactu_hash IS NOT NULL THEN
    RAISE EXCEPTION 'El ticket ya está emitido (verifactu_hash presente)';
  END IF;

  IF v_ticket.verifactu_status = 'enviando' THEN
    RAISE EXCEPTION 'Emisión ya en curso para este ticket';
  END IF;

  UPDATE public.tickets
  SET verifactu_status = 'enviando'
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$function$;


-- ----------------------------------------------------------------------------
-- fiscal_persistir_emision(p_ticket_id, p_restaurant_id, p_huella, p_estado, p_respuesta)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_persistir_emision(
  p_ticket_id     uuid,
  p_restaurant_id uuid,
  p_huella        text,
  p_estado        text,
  p_respuesta     jsonb
)
 RETURNS public.tickets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ticket    public.tickets;
  v_prev_hash varchar;
BEGIN
  -- Mismo lock por restaurante (R4): el cálculo de prev_hash + el UPDATE se
  -- hacen en exclusión mutua por restaurante.
  PERFORM pg_advisory_xact_lock(hashtext('fiscal:' || p_restaurant_id::text));

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado en el restaurante: %', p_ticket_id;
  END IF;

  -- prev_hash: huella del último ticket emitido del mismo restaurante.
  SELECT t.verifactu_hash INTO v_prev_hash
  FROM public.tickets t
  WHERE t.restaurant_id = p_restaurant_id
    AND t.id <> p_ticket_id
    AND t.verifactu_hash IS NOT NULL
  ORDER BY t.verifactu_sent_at DESC NULLS LAST
  LIMIT 1;

  UPDATE public.tickets
  SET verifactu_hash      = p_huella,
      verifactu_prev_hash = v_prev_hash,
      verifactu_status    = p_estado,
      verifactu_sent_at   = now(),
      verifactu_response  = p_respuesta
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$function$;


-- ----------------------------------------------------------------------------
-- fiscal_marcar_error_emision(p_ticket_id, p_restaurant_id, p_error)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_marcar_error_emision(
  p_ticket_id     uuid,
  p_restaurant_id uuid,
  p_error         text
)
 RETURNS public.tickets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ticket public.tickets;
BEGIN
  UPDATE public.tickets
  SET verifactu_status   = 'error',
      verifactu_response = jsonb_build_object('error', p_error, 'at', now())
  WHERE id = p_ticket_id AND restaurant_id = p_restaurant_id
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado en el restaurante: %', p_ticket_id;
  END IF;

  RETURN v_ticket;
END;
$function$;


-- ----------------------------------------------------------------------------
-- fiscal_anular_ticket(p_ticket_id, p_restaurant_id, p_motivo)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_anular_ticket(
  p_ticket_id     uuid,
  p_restaurant_id uuid,
  p_motivo        text
)
 RETURNS public.tickets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ticket public.tickets;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado en el restaurante: %', p_ticket_id;
  END IF;

  IF v_ticket.anulado IS TRUE THEN
    RAISE EXCEPTION 'El ticket ya está anulado';
  END IF;

  UPDATE public.tickets
  SET anulado          = true,
      anulado_at       = now(),
      motivo_anulacion = p_motivo
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$function$;


-- ── Permisos (nuevas firmas) ────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fiscal_claim_emision(uuid, uuid)                             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_persistir_emision(uuid, uuid, text, text, jsonb)      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_marcar_error_emision(uuid, uuid, text)                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_anular_ticket(uuid, uuid, text)                       TO authenticated, service_role;
