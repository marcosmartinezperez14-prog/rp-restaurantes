-- ============================================================================
-- 007_fiscal_immutability.sql
-- ----------------------------------------------------------------------------
-- INMUTABILIDAD FISCAL a nivel de BD. Estos triggers se ejecutan SIEMPRE,
-- incluso con service_role (los triggers no se saltan con RLS bypass), de modo
-- que ni la API ni un script con la service key pueden alterar/borrar datos
-- fiscales ya emitidos.
--
-- Reglas (tickets):
--   * Columnas fiscales CONGELADAS: cualquier cambio -> EXCEPTION.
--   * Lista BLANCA: únicas columnas editables tras la inserción.
--   * Transiciones controladas: hash no re-emitible, anulado solo false->true,
--     anulado_at se fija una sola vez.
--   * DELETE: nunca.
--
-- Reglas (payments):
--   * UPDATE / DELETE: nunca (cobro registrado = inmutable).
--
-- Todas las comparaciones usan IS DISTINCT FROM (NULL-safe).
-- Idempotente: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS antes de crear.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- tickets: BEFORE UPDATE — congelación de columnas fiscales + transiciones
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tickets_prevent_fiscal_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- ── Columnas fiscales CONGELADAS ──────────────────────────────────────────
  -- Identidad, emisor, importes y método de pago de la factura emitida no
  -- pueden cambiar NUNCA. (id es PK, tampoco cambia.)
  IF NEW.restaurant_id      IS DISTINCT FROM OLD.restaurant_id      THEN RAISE EXCEPTION 'Campo fiscal inmutable: restaurant_id';     END IF;
  IF NEW.order_id           IS DISTINCT FROM OLD.order_id           THEN RAISE EXCEPTION 'Campo fiscal inmutable: order_id';          END IF;
  IF NEW.ticket_number      IS DISTINCT FROM OLD.ticket_number      THEN RAISE EXCEPTION 'Campo fiscal inmutable: ticket_number';     END IF;
  IF NEW.series             IS DISTINCT FROM OLD.series             THEN RAISE EXCEPTION 'Campo fiscal inmutable: series';            END IF;
  IF NEW.sequential_number  IS DISTINCT FROM OLD.sequential_number  THEN RAISE EXCEPTION 'Campo fiscal inmutable: sequential_number'; END IF;
  IF NEW.issuer_name        IS DISTINCT FROM OLD.issuer_name        THEN RAISE EXCEPTION 'Campo fiscal inmutable: issuer_name';       END IF;
  IF NEW.issuer_nif         IS DISTINCT FROM OLD.issuer_nif         THEN RAISE EXCEPTION 'Campo fiscal inmutable: issuer_nif';        END IF;
  IF NEW.issuer_address     IS DISTINCT FROM OLD.issuer_address     THEN RAISE EXCEPTION 'Campo fiscal inmutable: issuer_address';    END IF;
  IF NEW.issued_at          IS DISTINCT FROM OLD.issued_at          THEN RAISE EXCEPTION 'Campo fiscal inmutable: issued_at';         END IF;
  IF NEW.subtotal           IS DISTINCT FROM OLD.subtotal           THEN RAISE EXCEPTION 'Campo fiscal inmutable: subtotal';          END IF;
  IF NEW.tax_breakdown      IS DISTINCT FROM OLD.tax_breakdown      THEN RAISE EXCEPTION 'Campo fiscal inmutable: tax_breakdown';     END IF;
  IF NEW.tax_total          IS DISTINCT FROM OLD.tax_total          THEN RAISE EXCEPTION 'Campo fiscal inmutable: tax_total';         END IF;
  IF NEW.total              IS DISTINCT FROM OLD.total              THEN RAISE EXCEPTION 'Campo fiscal inmutable: total';             END IF;
  IF NEW.discount_amount    IS DISTINCT FROM OLD.discount_amount    THEN RAISE EXCEPTION 'Campo fiscal inmutable: discount_amount';   END IF;
  IF NEW.payment_method     IS DISTINCT FROM OLD.payment_method     THEN RAISE EXCEPTION 'Campo fiscal inmutable: payment_method';    END IF;
  IF NEW.created_at         IS DISTINCT FROM OLD.created_at         THEN RAISE EXCEPTION 'Campo fiscal inmutable: created_at';        END IF;

  -- Lista BLANCA (editables, no se validan aquí salvo por las transiciones de
  -- abajo): verifactu_hash, verifactu_prev_hash, verifactu_status,
  -- verifactu_sent_at, verifactu_response, pdf_url, is_copy, anulado,
  -- anulado_at, motivo_anulacion, ticket_anulado_id.

  -- ── Transición: huella Verifactu no re-emitible ───────────────────────────
  -- Una factura ya emitida (verifactu_hash NOT NULL) no puede sobrescribir su
  -- huella (evita re-emisión / manipulación del encadenado).
  IF OLD.verifactu_hash IS NOT NULL
     AND NEW.verifactu_hash IS DISTINCT FROM OLD.verifactu_hash THEN
    RAISE EXCEPTION 'La factura ya está emitida: no se puede sobrescribir verifactu_hash';
  END IF;

  -- ── Transición: anulado solo puede pasar false/NULL -> true ───────────────
  -- (NULL se trata como "no anulado".) Nunca se "des-anula".
  IF OLD.anulado IS TRUE AND NEW.anulado IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Un ticket anulado no puede des-anularse (anulado: true -> false prohibido)';
  END IF;

  -- ── Transición: anulado_at se fija una sola vez ───────────────────────────
  IF OLD.anulado_at IS NOT NULL
     AND NEW.anulado_at IS DISTINCT FROM OLD.anulado_at THEN
    RAISE EXCEPTION 'anulado_at ya está fijado y no puede modificarse';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tickets_prevent_fiscal_update ON public.tickets;
CREATE TRIGGER trg_tickets_prevent_fiscal_update
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_prevent_fiscal_update();


-- ----------------------------------------------------------------------------
-- tickets: BEFORE DELETE — nunca se borra un ticket
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tickets_prevent_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Los tickets son inmutables: no se pueden borrar (usar anulación)';
END;
$function$;

DROP TRIGGER IF EXISTS trg_tickets_prevent_delete ON public.tickets;
CREATE TRIGGER trg_tickets_prevent_delete
  BEFORE DELETE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_prevent_delete();


-- ----------------------------------------------------------------------------
-- payments: BEFORE UPDATE OR DELETE — cobro registrado es inmutable
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payments_prevent_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'Los pagos son inmutables: no se pueden modificar ni borrar';
END;
$function$;

DROP TRIGGER IF EXISTS trg_payments_prevent_mutation ON public.payments;
CREATE TRIGGER trg_payments_prevent_mutation
  BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_prevent_mutation();
