# SQL — Desacoplar order_items.product_id de products

Ejecuta en el SQL Editor de Supabase:

```sql
-- Elimina la FK a products para que product_id pueda almacenar
-- cualquier UUID (tanto de products como de menu_items)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
```

Si el nombre de la constraint es distinto en tu base de datos, ejecuta esto
para encontrar el nombre exacto y borrarlo:

```sql
SELECT conname
FROM pg_constraint
WHERE conrelid = 'order_items'::regclass
  AND contype = 'f'
  AND conkey @> ARRAY[
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'order_items'::regclass AND attname = 'product_id')
  ];
```

Luego: `ALTER TABLE order_items DROP CONSTRAINT <nombre_encontrado>;`
