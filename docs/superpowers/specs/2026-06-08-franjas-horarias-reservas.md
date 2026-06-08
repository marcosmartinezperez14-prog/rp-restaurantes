# Franjas Horarias Múltiples por Día — Spec

**Fecha:** 2026-06-08
**Alcance:** Configuración de reservas — soporte de múltiples rangos horarios por día

---

## Objetivo

Permitir al admin/gerente configurar varios intervalos de reserva por día (ej. comidas 13:00–16:00 y cenas 20:00–23:30), en lugar de un único rango apertura–cierre.

---

## Cambio de modelo de datos

### Antes
```typescript
type DiaSchedule = { activo: boolean; apertura: string; cierre: string }
```

### Después
```typescript
type Franja = { apertura: string; cierre: string }
type DiaSchedule = { activo: boolean; franjas: Franja[] }
```

El campo JSONB `schedule` en `reservation_settings` pasa a almacenar el nuevo formato. La tabla es nueva (sin datos previos), no se necesita migración.

**Default por día:**
```json
{ "activo": true, "franjas": [{ "apertura": "13:00", "cierre": "23:30" }] }
```
Domingo: `activo: false`, misma franja de ejemplo.

---

## Validación (server action `guardarReservasConfig`)

- Día activo con `franjas.length === 0` → error: "Añade al menos una franja para {dia}"
- Por cada franja: formato HH:MM inválido → error
- Por cada franja: `apertura >= cierre` → error: "La hora de cierre debe ser posterior a la apertura ({dia})"
- Sin validación de solapamiento entre franjas (el admin decide libremente)

---

## Validación (API pública `POST /api/cliente/[slug]/reservas`)

La hora solicitada se acepta si cae dentro de **cualquiera** de las franjas del día:
```
hora >= franja.apertura && hora < franja.cierre
```
Si ninguna franja la contiene → 400 `"Fuera del horario de reservas"`

---

## UI — `ReservasConfigPanel`

Por cada día activo se muestra la lista de franjas:

```
[toggle ON]  Lunes
             13:00  hasta  23:30  [×]
             20:00  hasta  23:00  [×]
             [+ Añadir franja]

[toggle OFF] Domingo              Cerrado
```

Comportamiento:
- Toggle OFF → franjas ocultas, conservadas en estado
- Toggle ON con `franjas.length === 0` → añade automáticamente `{ apertura: '', cierre: '' }`
- Botón "×" elimina la franja (no disponible si es la única)
- "+ Añadir franja" → appenda `{ apertura: '', cierre: '' }` a la lista

---

## Archivos afectados

| Acción | Archivo |
|--------|---------|
| MODIFICAR | `types/administracion.ts` |
| MODIFICAR | `app/actions/administracion.ts` |
| MODIFICAR | `components/administracion/ReservasConfigPanel.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/reservas/route.ts` |
