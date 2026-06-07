-- ============================================================
-- Limpia todos los datos transaccionales visibles en la web
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Movimientos de stock (página Productos → Movimientos)
DELETE FROM stock_movements;

-- 2. Items de pedidos (TPV → Comanda)
DELETE FROM order_items;

-- 3. Pagos (TPV → Cobro)
DELETE FROM payments;

-- 4. Tickets (recibos generados)
DELETE FROM tickets;

-- 5. Pedidos/comandas (TPV)
DELETE FROM orders;

-- 6. Reservas (página Reservas)
DELETE FROM reservations;

-- 7. Ingredientes de carta (Productos → Carta)
DELETE FROM menu_item_ingredients;

-- 8. Items de carta (Productos → Carta)
DELETE FROM menu_items;
