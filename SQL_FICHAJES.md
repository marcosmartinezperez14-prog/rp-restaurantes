# SQL — Módulo de Fichajes

Ejecuta en el SQL Editor de Supabase en este orden.

---

## 1. Tabla `fichajes`

```sql
CREATE TABLE IF NOT EXISTS fichajes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  entrada_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  salida_at      TIMESTAMPTZ,
  duracion_min   INT GENERATED ALWAYS AS (
    CASE WHEN salida_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (salida_at - entrada_at))::INT / 60
      ELSE NULL
    END
  ) STORED,
  nota           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fichajes_restaurant_user_idx ON fichajes (restaurant_id, user_id);
CREATE INDEX IF NOT EXISTS fichajes_entrada_at_idx      ON fichajes (entrada_at);

ALTER TABLE fichajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_isolation" ON fichajes
  USING (restaurant_id = get_current_restaurant_id());
```

---

## 2. Función `get_estado_fichaje`

Devuelve el turno abierto del usuario autenticado (si existe).

```sql
CREATE OR REPLACE FUNCTION get_estado_fichaje()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (
      SELECT json_build_object(
        'abierto',     true,
        'fichaje_id',  f.id::text,
        'entrada_at',  f.entrada_at
      )
      FROM fichajes f
      JOIN users u ON u.id = f.user_id
      WHERE u.auth_id        = auth.uid()
        AND f.restaurant_id  = get_current_restaurant_id()
        AND f.salida_at      IS NULL
      ORDER BY f.entrada_at DESC
      LIMIT 1
    ),
    '{"abierto": false}'::json
  );
$$;

GRANT EXECUTE ON FUNCTION get_estado_fichaje TO authenticated;
```

---

## 3. Función `fichar_entrada`

Registra la entrada. Devuelve error si ya hay un turno abierto.

```sql
CREATE OR REPLACE FUNCTION fichar_entrada(p_nota TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id      UUID;
  v_restaurant   UUID;
  v_nuevo_id     UUID;
BEGIN
  SELECT u.id, u.restaurant_id
    INTO v_user_id, v_restaurant
    FROM users u
   WHERE u.auth_id = auth.uid()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN '{"error": "Usuario no encontrado"}'::json;
  END IF;

  -- Verificar que no hay turno abierto
  IF EXISTS (
    SELECT 1 FROM fichajes
     WHERE user_id       = v_user_id
       AND restaurant_id = v_restaurant
       AND salida_at     IS NULL
  ) THEN
    RETURN '{"error": "Ya tienes un turno abierto"}'::json;
  END IF;

  INSERT INTO fichajes (restaurant_id, user_id, nota)
    VALUES (v_restaurant, v_user_id, p_nota)
    RETURNING id INTO v_nuevo_id;

  RETURN json_build_object('ok', true, 'id', v_nuevo_id);
END;
$$;

GRANT EXECUTE ON FUNCTION fichar_entrada(TEXT) TO authenticated;
```

---

## 4. Función `fichar_salida`

Cierra el turno abierto del usuario autenticado.

```sql
CREATE OR REPLACE FUNCTION fichar_salida(p_nota TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    UUID;
  v_restaurant UUID;
  v_fichaje_id UUID;
BEGIN
  SELECT u.id, u.restaurant_id
    INTO v_user_id, v_restaurant
    FROM users u
   WHERE u.auth_id = auth.uid()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN '{"error": "Usuario no encontrado"}'::json;
  END IF;

  SELECT id INTO v_fichaje_id
    FROM fichajes
   WHERE user_id       = v_user_id
     AND restaurant_id = v_restaurant
     AND salida_at     IS NULL
   ORDER BY entrada_at DESC
   LIMIT 1;

  IF v_fichaje_id IS NULL THEN
    RETURN '{"error": "No tienes ningún turno abierto"}'::json;
  END IF;

  UPDATE fichajes
     SET salida_at = now(),
         nota      = COALESCE(p_nota, nota)
   WHERE id = v_fichaje_id;

  RETURN json_build_object('ok', true, 'id', v_fichaje_id);
END;
$$;

GRANT EXECUTE ON FUNCTION fichar_salida(TEXT) TO authenticated;
```

---

## 5. Función `get_fichajes_rango`

Devuelve el historial filtrado por rango de fechas y usuario (opcional).
Sin `p_user_id` devuelve solo los del usuario autenticado; los admins pasan `p_user_id = null` para ver todos.

```sql
CREATE OR REPLACE FUNCTION get_fichajes_rango(
  p_desde   TIMESTAMPTZ DEFAULT NULL,
  p_hasta   TIMESTAMPTZ DEFAULT NULL,
  p_user_id UUID        DEFAULT NULL
)
RETURNS TABLE (
  fichaje_id   UUID,
  user_id      UUID,
  nombre       TEXT,
  entrada_at   TIMESTAMPTZ,
  salida_at    TIMESTAMPTZ,
  duracion_min INT,
  nota         TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    f.id            AS fichaje_id,
    f.user_id,
    u.nombre        AS nombre,
    f.entrada_at,
    f.salida_at,
    f.duracion_min,
    f.nota
  FROM fichajes f
  JOIN users u ON u.id = f.user_id
  WHERE f.restaurant_id = get_current_restaurant_id()
    AND (p_user_id IS NULL OR f.user_id = p_user_id)
    AND (p_desde   IS NULL OR f.entrada_at >= p_desde)
    AND (p_hasta   IS NULL OR f.entrada_at <= p_hasta)
  ORDER BY f.entrada_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_fichajes_rango(TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
```

---

## 6. Verificación

```sql
SELECT routine_name
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name IN (
     'get_estado_fichaje',
     'fichar_entrada',
     'fichar_salida',
     'get_fichajes_rango'
   );
```

Resultado esperado: 4 filas.
