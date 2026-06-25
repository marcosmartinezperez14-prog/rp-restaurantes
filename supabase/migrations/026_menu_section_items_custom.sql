-- Allow menu section items to have a free-text name (not linked to carta)
ALTER TABLE menu_section_items
  ALTER COLUMN menu_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Ensure at least one of the two is set
ALTER TABLE menu_section_items
  DROP CONSTRAINT IF EXISTS menu_section_items_name_check,
  ADD CONSTRAINT menu_section_items_name_check
    CHECK (menu_item_id IS NOT NULL OR (custom_name IS NOT NULL AND custom_name <> ''));

-- The existing UNIQUE(section_id, menu_item_id) still works: Postgres allows
-- multiple NULLs in a unique index, so custom items won't conflict.
