-- Fase 5 papelera: turnos, dias_libres, solicitudes_vacaciones

-- turnos
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_turnos_deleted_at
  ON turnos (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- dias_libres
ALTER TABLE dias_libres
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dias_libres_deleted_at
  ON dias_libres (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- solicitudes_vacaciones
ALTER TABLE solicitudes_vacaciones
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_vacaciones_deleted_at
  ON solicitudes_vacaciones (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- RLS: impedir DELETE directo vía cliente autenticado
CREATE POLICY "No DELETE directo turnos"
  ON turnos
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "No DELETE directo dias_libres"
  ON dias_libres
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "No DELETE directo solicitudes_vacaciones"
  ON solicitudes_vacaciones
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);
