-- Papelera Fase 1: añadir deleted_by a las tablas que ya tienen deleted_at,
-- y políticas RLS que bloquean DELETE directo por usuarios autenticados
-- (solo service_role puede borrar físicamente — defensa en profundidad).

-- ─── Columna deleted_by ───────────────────────────────────────────────────────
-- Nullable: el código existente que ya hacía soft-delete no la seteaba,
-- así que los registros antiguos quedarán con NULL (aceptable).

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── Políticas RLS FOR DELETE ─────────────────────────────────────────────────
-- Bloquean DELETE directo desde clientes autenticados (JWT).
-- Las Server Actions usan service_role y bypasean RLS, por lo que el hard-delete
-- desde la papelera sigue funcionando.
-- El soft-delete existente usa UPDATE, no DELETE → no se ve afectado.

-- Habilitar RLS en tablas que puedan no tenerlo aún
ALTER TABLE public.tables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products   ENABLE ROW LEVEL SECURITY;

-- Bloquear DELETE para cualquier usuario autenticado
-- (service_role no se ve afectado por RLS)
CREATE POLICY "papelera_no_delete_tables"
  ON public.tables FOR DELETE TO authenticated USING (false);

CREATE POLICY "papelera_no_delete_zones"
  ON public.zones FOR DELETE TO authenticated USING (false);

CREATE POLICY "papelera_no_delete_categories"
  ON public.categories FOR DELETE TO authenticated USING (false);

CREATE POLICY "papelera_no_delete_menu_items"
  ON public.menu_items FOR DELETE TO authenticated USING (false);

CREATE POLICY "papelera_no_delete_products"
  ON public.products FOR DELETE TO authenticated USING (false);

-- NOTA: clearAllData en app/actions/admin.ts hace DELETE real en menu_items
-- usando el cliente de sesión (no service_role). Si aplicas esta migración,
-- esa función fallará al intentar borrar menu_items. Debes actualizarla para
-- usar supabaseAdmin en su lugar, o eliminar menu_items de su lista de tablas.
