# SQL — Slug en restaurants

Ejecuta en el SQL Editor de Supabase:

```sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

UPDATE restaurants
  SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE slug IS NULL;
```
