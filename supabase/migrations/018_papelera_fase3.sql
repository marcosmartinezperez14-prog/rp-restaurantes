-- Fase 3 papelera: product_modifier_groups y product_modifier_options

-- product_modifier_groups
ALTER TABLE product_modifier_groups
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pmg_deleted_at
  ON product_modifier_groups (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- product_modifier_options
ALTER TABLE product_modifier_options
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        null REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pmo_deleted_at
  ON product_modifier_options (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- RLS: impedir DELETE directo para rol authenticated; usar soft-delete vía UPDATE
CREATE POLICY "No DELETE directo grupos modificadores"
  ON product_modifier_groups
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "No DELETE directo opciones modificadores"
  ON product_modifier_options
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);
