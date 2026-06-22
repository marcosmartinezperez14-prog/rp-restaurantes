-- Sistema de menús: menú cerrado y menú del día

CREATE TABLE IF NOT EXISTS menus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('cerrado', 'menu_del_dia')),
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id    UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_section_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   UUID NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(section_id, menu_item_id)
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_section_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menus_restaurant" ON menus FOR ALL
  USING (restaurant_id = get_current_restaurant_id())
  WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "menu_sections_restaurant" ON menu_sections FOR ALL
  USING (menu_id IN (SELECT id FROM menus WHERE restaurant_id = get_current_restaurant_id()));

CREATE POLICY "menu_section_items_restaurant" ON menu_section_items FOR ALL
  USING (section_id IN (
    SELECT ms.id FROM menu_sections ms
    JOIN menus m ON m.id = ms.menu_id
    WHERE m.restaurant_id = get_current_restaurant_id()
  ));

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER menus_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
