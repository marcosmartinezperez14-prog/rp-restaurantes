-- ============================================================================
-- 008_fiscal_mutation_rpcs.sql
-- ----------------------------------------------------------------------------
-- RPCs de mutación fiscal — SECURITY DEFINER.
--
-- Por qué SECURITY DEFINER:
--   * Resuelven el "no-op silencioso" cuando no hay policy UPDATE para el rol
--     (la fila no se actualiza pero no hay error).
--   * Dan atomicidad y bloqueo de fila (SELECT ... FOR UPDATE) para evitar
--     condiciones de carrera (doble envío a Verifacti, doble anulación).
--
-- Estas RPCs SOLO tocan columnas de la lista blanca de 007 (verifactu_*,
-- anulado*, motivo_anulacion), así que pasan los triggers de inmutabilidad.
--
-- search_path fijado a 'public, pg_temp' para evitar secuestro de resolución
-- de nombres en funciones SECURITY DEFINER.
-- Idempotente: CREATE OR REPLACE FUNCTION.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- fiscal_claim_emision(p_ticket_id)
-- Reclama un ticket para emisión. Bloquea la fila, rechaza si ya está emitida
-- o si otra emisión está en curso ('enviando'), y marca 'enviando'.
-- Devuelve la fila reclamada. Evita el doble envío a Verifacti.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_claim_emision(p_ticket_id uuid)
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
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado: %', p_ticket_id;
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
-- fiscal_persistir_emision(p_ticket_id, p_huella, p_estado, p_respuesta)
-- Persiste el resultado de una emisión correcta. Calcula prev_hash = huella del
-- último ticket emitido del MISMO restaurante (por verifactu_sent_at DESC),
-- NULL si es el primero. Bloquea la fila.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_persistir_emision(
  p_ticket_id uuid,
  p_huella    text,
  p_estado    text,
  p_respuesta jsonb
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
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado: %', p_ticket_id;
  END IF;

  -- prev_hash: huella del último ticket emitido del mismo restaurante.
  SELECT t.verifactu_hash INTO v_prev_hash
  FROM public.tickets t
  WHERE t.restaurant_id = v_ticket.restaurant_id
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
-- fiscal_marcar_error_emision(p_ticket_id, p_error)
-- Marca la emisión como fallida (permite reintento: no fija verifactu_hash) y
-- guarda el error en verifactu_response.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_marcar_error_emision(
  p_ticket_id uuid,
  p_error     text
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
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado: %', p_ticket_id;
  END IF;

  RETURN v_ticket;
END;
$function$;


-- ----------------------------------------------------------------------------
-- fiscal_anular_ticket(p_ticket_id, p_motivo)
-- Anula un ticket. Bloquea la fila, rechaza si ya está anulado, y fija
-- anulado=true, anulado_at=now(), motivo_anulacion.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fiscal_anular_ticket(
  p_ticket_id uuid,
  p_motivo    text
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
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket no encontrado: %', p_ticket_id;
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


-- ----------------------------------------------------------------------------
-- Permisos: ejecutables desde la API autenticada y service_role.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.fiscal_claim_emision(uuid)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_persistir_emision(uuid, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_marcar_error_emision(uuid, text)          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fiscal_anular_ticket(uuid, text)                 TO authenticated, service_role;
