# SQL Migration — Finanzas

Ejecuta este SQL en el editor de Supabase (SQL Editor):

```sql
-- Tabla de movimientos financieros manuales
CREATE TABLE movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  concepto TEXT NOT NULL,
  importe DECIMAL(10,2) NOT NULL CHECK (importe > 0),
  categoria TEXT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimientos_restaurant_id ON movimientos(restaurant_id);
CREATE INDEX idx_movimientos_tipo ON movimientos(tipo);
CREATE INDEX idx_movimientos_fecha ON movimientos(fecha);

CREATE TRIGGER update_movimientos_updated_at
  BEFORE UPDATE ON movimientos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimientos_select" ON movimientos
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "movimientos_insert" ON movimientos
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "movimientos_update" ON movimientos
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "movimientos_delete" ON movimientos
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());
```
