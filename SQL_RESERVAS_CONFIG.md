# SQL — Tabla reservation_settings

Ejecuta en el SQL Editor de Supabase:

```sql
CREATE TABLE IF NOT EXISTS reservation_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  auto_confirm     BOOLEAN NOT NULL DEFAULT true,
  duration_minutes INT NOT NULL DEFAULT 90,
  schedule         JSONB NOT NULL DEFAULT '{
    "lunes":     { "activo": true,  "franjas": [{"apertura": "13:00", "cierre": "23:30"}] },
    "martes":    { "activo": true,  "franjas": [{"apertura": "13:00", "cierre": "23:30"}] },
    "miercoles": { "activo": true,  "franjas": [{"apertura": "13:00", "cierre": "23:30"}] },
    "jueves":    { "activo": true,  "franjas": [{"apertura": "13:00", "cierre": "23:30"}] },
    "viernes":   { "activo": true,  "franjas": [{"apertura": "13:00", "cierre": "23:30"}] },
    "sabado":    { "activo": true,  "franjas": [{"apertura": "13:00", "cierre": "23:30"}] },
    "domingo":   { "activo": false, "franjas": [{"apertura": "13:00", "cierre": "23:30"}] }
  }'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reservation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_isolation" ON reservation_settings
  USING (restaurant_id = get_current_restaurant_id());
```
