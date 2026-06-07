# Configuración de Reservas + Sección Administración — Spec

**Fecha:** 2026-06-07
**Estado:** Aprobado

---

## Objetivo

Permitir al administrador y gerente configurar las reglas de reservas del restaurante: días y horarios disponibles, duración estimada por reserva y si las reservas públicas se confirman automáticamente o requieren confirmación manual del staff.

---

## Base de datos

### Nueva tabla `reservation_settings`

```sql
CREATE TABLE IF NOT EXISTS reservation_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  auto_confirm     BOOLEAN NOT NULL DEFAULT true,
  duration_minutes INT NOT NULL DEFAULT 90,
  schedule         JSONB NOT NULL DEFAULT '{
    "lunes":     { "activo": true, "apertura": "13:00", "cierre": "23:30" },
    "martes":    { "activo": true, "apertura": "13:00", "cierre": "23:30" },
    "miercoles": { "activo": true, "apertura": "13:00", "cierre": "23:30" },
    "jueves":    { "activo": true, "apertura": "13:00", "cierre": "23:30" },
    "viernes":   { "activo": true, "apertura": "13:00", "cierre": "23:30" },
    "sabado":    { "activo": true, "apertura": "13:00", "cierre": "23:30" },
    "domingo":   { "activo": false, "apertura": "13:00", "cierre": "23:30" }
  }'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reservation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurant_isolation" ON reservation_settings
  USING (restaurant_id = get_current_restaurant_id());
```

### Tipo TypeScript del schedule

```typescript
type DiaSchedule = {
  activo: boolean
  apertura: string  // "HH:MM"
  cierre: string    // "HH:MM"
}

type Schedule = {
  lunes: DiaSchedule
  martes: DiaSchedule
  miercoles: DiaSchedule
  jueves: DiaSchedule
  viernes: DiaSchedule
  sabado: DiaSchedule
  domingo: DiaSchedule
}
```

### Comportamiento si no existe fila

Si el restaurante no tiene fila en `reservation_settings`, la API pública acepta la reserva sin validar horario y la confirma automáticamente (comportamiento actual preservado).

---

## Sección Administración en el dashboard

### Nueva tarjeta en el menú principal

- **Href:** `/dashboard/administracion`
- **Icono:** ⚙️ (o similar administrativo)
- **Label:** Administración
- **Descripción:** Configuración avanzada del restaurante
- **Acceso:** roles `admin` y `gerente` (módulo `administracion`)
- **Añadir** `administracion` a `PERMISOS_POR_ROL` en `types/equipo.ts` para esos dos roles

### Ruta

`app/dashboard/administracion/page.tsx` — Server Component con auth check + carga de `reservation_settings`. Renderiza `ReservasConfigPanel`.

### Componente `ReservasConfigPanel`

`components/administracion/ReservasConfigPanel.tsx` — Client Component con tres bloques:

**Bloque 1: Horario por día**

7 filas ordenadas lunes→domingo. Cada fila:
- Toggle on/off (activo)
- Si activo: inputs `type="time"` para apertura y cierre
- Si inactivo: los inputs están ocultos y se muestra "Cerrado"

**Bloque 2: Duración estimada**

Input numérico (minutos). Ejemplo: 90 → "1h 30min". Valor mínimo: 15. Mostrar la conversión en texto debajo del input.

**Bloque 3: Confirmación automática**

Toggle con label: "Confirmar reservas automáticamente".
- ON: "Las reservas públicas se confirman al instante"
- OFF: "Las reservas llegan como pendientes y el staff las confirma manualmente"

**Botón Guardar:** llama a server action `guardarReservasConfig`. Muestra estado de éxito/error.

---

## Server action `guardarReservasConfig`

`app/actions/administracion.ts`

- Auth check + obtener `restaurant_id`
- Validación: horarios bien formados (HH:MM), cierre > apertura en días activos, `duration_minutes` entre 15 y 480
- Upsert en `reservation_settings` con `onConflict: 'restaurant_id'`
- Devuelve `{ ok: true }` o `{ error: string }`

---

## Integración con API pública de reservas

`app/api/cliente/[slug]/reservas/route.ts` — modificar el POST:

1. Consultar `reservation_settings` con `supabaseAdmin` usando el `restaurant_id`
2. Si no existe configuración → confirmar automáticamente, sin validar horario
3. Si existe:
   a. Determinar el día de la semana de `fecha` (en español: lunes, martes, etc.)
   b. Si el día está `activo: false` → 400 `'El restaurante no acepta reservas ese día'`
   c. Si `hora` < `apertura` o `hora` >= `cierre` → 400 `'Fuera del horario de reservas'`
   d. `status`: `'confirmed'` si `auto_confirm = true`, `'pending'` si `false`
4. Incluir `auto_confirm` en la respuesta: `{ ok: true, id, auto_confirm }`

---

## Formulario público de reserva

`app/cliente/[slug]/reservas/page.tsx` — modificar la pantalla de confirmación:

- Si `auto_confirm = true` (o no vino en respuesta):
  - Título: "¡Reserva confirmada!"
  - Texto: "Te esperamos el {fecha} a las {hora}h."
- Si `auto_confirm = false`:
  - Título: "Reserva recibida"
  - Texto: "Te confirmaremos lo antes posible."

---

## Dashboard de reservas — botón Confirmar

`app/actions/reservas.ts` — la función `updateReservationStatus` ya existe y soporta cambiar el status. Solo hay que exponer el cambio `pending → confirmed` en la UI.

`components/reservas/ReservationsList.tsx` — añadir `pending` a `STATUS_CONFIG` y a `NEXT_STATUSES`:
```typescript
STATUS_CONFIG.pending = { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
NEXT_STATUSES.pending = ['confirmed', 'cancelled']
```

---

## Restricciones

- Toda la UI en español
- Sin `<form>`, usar `onClick`
- Solo admin y gerente acceden a `/dashboard/administracion`
- El módulo `administracion` debe añadirse a `PERMISOS_POR_ROL` para esos roles
- Si no hay configuración de reservas, el comportamiento actual se preserva (sin romper nada)
