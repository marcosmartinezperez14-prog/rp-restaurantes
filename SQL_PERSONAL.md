# SQL Módulo Personal

Ejecuta este SQL en el editor de Supabase (SQL Editor).

```sql
-- Tabla turnos
CREATE TABLE IF NOT EXISTS turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'normal' CHECK (tipo IN ('normal', 'extra', 'guardia')),
  notas TEXT,
  creado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_turnos_restaurant_id ON turnos(restaurant_id);
CREATE INDEX idx_turnos_empleado_id ON turnos(empleado_id);
CREATE INDEX idx_turnos_fecha ON turnos(fecha);

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "turnos_select" ON turnos
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "turnos_insert" ON turnos
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "turnos_update" ON turnos
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "turnos_delete" ON turnos
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());

-- Tabla dias_libres
CREATE TABLE IF NOT EXISTS dias_libres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'libre' CHECK (tipo IN ('libre', 'festivo', 'baja')),
  notas TEXT,
  creado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dias_libres_restaurant_id ON dias_libres(restaurant_id);
CREATE INDEX idx_dias_libres_empleado_id ON dias_libres(empleado_id);
CREATE INDEX idx_dias_libres_fecha ON dias_libres(fecha);

ALTER TABLE dias_libres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dias_libres_select" ON dias_libres
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "dias_libres_insert" ON dias_libres
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "dias_libres_update" ON dias_libres
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "dias_libres_delete" ON dias_libres
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());

-- Tabla solicitudes_vacaciones
CREATE TABLE IF NOT EXISTS solicitudes_vacaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'denegada')),
  comentario_respuesta TEXT,
  respondido_por UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solicitudes_vacaciones_restaurant_id ON solicitudes_vacaciones(restaurant_id);
CREATE INDEX idx_solicitudes_vacaciones_empleado_id ON solicitudes_vacaciones(empleado_id);
CREATE INDEX idx_solicitudes_vacaciones_estado ON solicitudes_vacaciones(estado);

ALTER TABLE solicitudes_vacaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solicitudes_vacaciones_select" ON solicitudes_vacaciones
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "solicitudes_vacaciones_insert" ON solicitudes_vacaciones
  FOR INSERT WITH CHECK (restaurant_id = get_current_restaurant_id());

CREATE POLICY "solicitudes_vacaciones_update" ON solicitudes_vacaciones
  FOR UPDATE USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "solicitudes_vacaciones_delete" ON solicitudes_vacaciones
  FOR DELETE USING (restaurant_id = get_current_restaurant_id());
```
