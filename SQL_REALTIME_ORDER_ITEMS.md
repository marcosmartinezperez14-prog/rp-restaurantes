# SQL — Activar Realtime en order_items

Ejecuta en el SQL Editor de Supabase:

```sql
-- Habilitar REPLICA IDENTITY FULL para recibir datos completos en cada UPDATE
ALTER TABLE order_items REPLICA IDENTITY FULL;

-- Añadir la tabla a la publicación de Realtime (si no está ya)
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
```
