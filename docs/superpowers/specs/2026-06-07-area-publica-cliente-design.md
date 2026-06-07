# Área pública de cliente — Spec

**Fecha:** 2026-06-07  
**Estado:** Aprobado

---

## Objetivo

Crear un área pública accesible sin autenticación con dos modos:
- **URL pública** (`/cliente/[slug]`): carta del restaurante + formulario de reserva
- **QR de mesa** (`/cliente/[slug]/mesa/[mesa_id]`): carta + carrito + envío de pedido directo al TPV y cocina

---

## Correcciones respecto al spec original

| Spec original dice | Realidad del proyecto |
|---|---|
| tabla `restaurantes` | tabla `restaurants` |
| crear tabla `reservas` | usar tabla `reservations` existente |
| crear tabla `reservas` separada | las reservas públicas aparecen en el dashboard |

---

## SQL necesario

```sql
-- Añadir slug a restaurants (único archivo a ejecutar)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
UPDATE restaurants
  SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]', '-', 'g'))
  WHERE slug IS NULL;
```

No se necesitan nuevas políticas RLS. Todas las API routes públicas usan service role key (bypass total), igual que `app/api/equipo/crear-usuario/route.ts`.

---

## Estructura de rutas

```
app/cliente/[slug]/
  layout.tsx                    ← Layout público independiente
  page.tsx                      ← Carta + botón reservar (Server Component)
  reservas/
    page.tsx                    ← Formulario de reserva (Client Component)
  mesa/
    [mesa_id]/
      page.tsx                  ← Carta + carrito + enviar pedido (Client Component)

app/api/cliente/
  [slug]/
    route.ts                    ← GET info restaurante por slug
    carta/
      route.ts                  ← GET menu_items activos agrupados por categoría
    reservas/
      route.ts                  ← POST → inserta en reservations
    mesa/
      [mesa_id]/
        route.ts                ← GET mesa+carta / POST → orders + order_items
```

---

## Detalles por componente

### Layout público (`layout.tsx`)
- Completamente independiente de `AppShell` y cualquier componente del dashboard
- Header simple: nombre del restaurante (cargado en la página padre via slot o prop)
- Fondo blanco, sin navbar de gestión
- Mobile-first

### Carta pública (`page.tsx` — Server)
- Lee `restaurants` por slug con service role; si no existe → `notFound()`
- Lee `menu_items` donde `is_active = true` AND `deleted_at IS NULL`
- Agrupa por categoría (`categories.name`)
- Muestra: nombre del plato, descripción, precio formateado, imagen si existe
- Botón "Reservar mesa" → enlace a `./reservas`
- Sin ningún enlace al dashboard

### Formulario de reserva (`reservas/page.tsx` — Client)
- Campos: nombre, teléfono, fecha, hora, número de personas, notas (opcional)
- Validación en cliente antes de enviar
- `fetch POST /api/cliente/[slug]/reservas`
- Al completar: pantalla de confirmación en la misma página (sin redirección)
- Sin `useRouter`, sin enlaces internos del sistema

### Pedido QR (`mesa/[mesa_id]/page.tsx` — Client)
- Carga carta igual que la página principal
- Carrito local con `useState`: añadir/quitar platos, cantidades
- Carrito flotante (fixed bottom) con total y botón "Enviar pedido"
- `fetch POST /api/cliente/[slug]/mesa/[mesa_id]`
- Al confirmar: pantalla "Pedido enviado, el equipo lo preparará"

---

## API Routes

### `GET /api/cliente/[slug]`
- Busca en `restaurants` por slug
- Devuelve: `{ id, name, slug, logo_url, descripcion }`
- 404 si no existe

### `GET /api/cliente/[slug]/carta`
- Busca restaurant por slug → obtiene `restaurant_id`
- Query `menu_items` activos con join a categoría
- Devuelve: `{ categorias: [{ nombre, items: [{ id, nombre, descripcion, precio, imagen_url }] }] }`

### `POST /api/cliente/[slug]/reservas`
- Body: `{ nombre_cliente, telefono, fecha, hora, num_personas, notas? }`
- Validación servidor: campos obligatorios presentes
- Inserta en `reservations` (tabla existente) con `status: 'confirmed'`
- Campos mapeados: `customer_name`, `customer_phone`, `party_size`, `reservation_date`, `reservation_time`, `notes`
- Devuelve: `{ ok: true, id }`

### `GET /api/cliente/[slug]/mesa/[mesa_id]`
- Valida que `mesa_id` pertenezca al restaurante del slug
- Devuelve datos de la mesa + carta igual que `/carta`

### `POST /api/cliente/[slug]/mesa/[mesa_id]`
- Body: `{ items: [{ menu_item_id, nombre, precio, cantidad }] }`
- Busca order abierto para la mesa (`status: 'open'`); si no existe, crea uno
- Inserta en `order_items` con `status: 'pending'` para cada item
- Actualiza `tables.status` a `'occupied'`
- Devuelve: `{ ok: true, order_id }`

---

## Protección de rutas

No hay `middleware.ts` en el proyecto. La protección del dashboard se hace en cada página con `redirect('/login')`. Las rutas `/cliente/**` simplemente no incluyen ese check → son públicas por naturaleza. No se requiere ningún cambio en archivos de auth existentes.

---

## Restricciones

- Toda la UI en español
- Mobile-first
- Sin etiquetas `<form>`, usar `onClick`/`onChange`
- No tocar TPV, dashboard, ni módulos existentes
- Service role key en todas las API routes del área cliente
- El cliente nunca ve rutas del dashboard
