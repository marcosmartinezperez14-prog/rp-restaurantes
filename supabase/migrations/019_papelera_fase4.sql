-- Fase 4 papelera: roles personalizados (restaurant_id NOT NULL)

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roles_deleted_at
  ON roles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Impedir DELETE directo vía cliente autenticado; solo service_role puede eliminar físicamente
CREATE POLICY "No DELETE directo roles"
  ON roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);
