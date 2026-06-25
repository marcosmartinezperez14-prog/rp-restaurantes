-- Add seleccion field to menu_sections
-- When true: the client chooses one dish from the section (e.g. "Primer plato")
-- When false: all dishes are served, no selection needed (e.g. "Entrantes")

ALTER TABLE menu_sections
  ADD COLUMN IF NOT EXISTS seleccion boolean NOT NULL DEFAULT true;
