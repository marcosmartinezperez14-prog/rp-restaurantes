# SQL — Añadir recurrencia a movimientos

Ejecuta en el SQL Editor de Supabase:

```sql
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS recurrencia TEXT NOT NULL DEFAULT 'unico'
  CHECK (recurrencia IN ('unico', 'mensual', 'anual'));
```
