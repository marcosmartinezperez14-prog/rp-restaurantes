-- Papelera Fase 2: soft delete para reservas y movimientos financieros.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índices para que los filtros IS NULL sean eficientes
CREATE INDEX IF NOT EXISTS idx_reservations_deleted_at ON public.reservations (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_deleted_at  ON public.movimientos  (deleted_at) WHERE deleted_at IS NULL;

-- Políticas RLS FOR DELETE: bloquear borrado físico desde clientes autenticados.
-- Las Server Actions usan service_role y bypasean RLS → el hard-delete de la
-- papelera sigue funcionando.
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "papelera_no_delete_reservations"
  ON public.reservations FOR DELETE TO authenticated USING (false);

CREATE POLICY "papelera_no_delete_movimientos"
  ON public.movimientos  FOR DELETE TO authenticated USING (false);
