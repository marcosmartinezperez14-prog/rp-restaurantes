---
title: Superadmin — Acceso remoto a restaurantes
date: 2026-06-19
status: approved
---

## Objetivo

Permitir al superadmin acceder al dashboard de cualquier restaurante con permisos completos, sin cambiar de sesión, mediante una cookie de override y un cliente admin que bypasea RLS.

## Flujo de usuario

1. Superadmin entra en `/superadmin` y ve la lista de restaurantes
2. Pulsa "Acceder" en la fila de un restaurante
3. Server action `iniciarSesionRemota(restaurantId)` verifica que es superadmin, escribe cookie `sa_restaurant_id` con el restaurantId, redirige a `/dashboard`
4. En el dashboard aparece un banner: "Modo superadmin · [Nombre restaurante] · Salir"
5. Todas las acciones del dashboard operan sobre el restaurante seleccionado usando el admin client (bypass RLS)
6. Al pulsar "Salir", server action `cerrarSesionRemota()` borra la cookie y redirige a `/superadmin`

## Cookie

- Nombre: `sa_restaurant_id`
- Valor: UUID del restaurante
- Atributos: `httpOnly`, `sameSite: lax`, `path: /`, sin `maxAge` (expira al cerrar el navegador)
- Seguridad: verificada en cada request — solo tiene efecto si el usuario activo es superadmin

## Componentes nuevos / modificados

### `lib/auth/restaurant-context.ts` (nuevo)

Función central exportada:

```ts
export interface RestaurantContext {
  supabase: SupabaseClient
  restaurantId: string
  isSuperadminMode: boolean
}

export async function getRestaurantContext(): Promise<RestaurantContext | null>
```

Lógica:
1. Lee `sa_restaurant_id` de las cookies del request
2. Si existe: verifica que el usuario actual es superadmin (con admin client)
   - Si es superadmin → devuelve `{ supabase: adminClient, restaurantId: cookieValue, isSuperadminMode: true }`
   - Si no es superadmin → ignora la cookie, continúa con flujo normal
3. Si no existe (flujo normal): `createClient()`, `getUser()`, busca `restaurant_id` en tabla `users`
   - Si encuentra → `{ supabase: userClient, restaurantId, isSuperadminMode: false }`
   - Si no → `null`

### `app/actions/superadmin.ts` (modificado)

Añadir dos acciones:

```ts
export async function iniciarSesionRemota(restaurantId: string): Promise<never>
export async function cerrarSesionRemota(): Promise<never>
```

- `iniciarSesionRemota`: verifica superadmin, setea cookie `sa_restaurant_id`, redirige a `/dashboard`
- `cerrarSesionRemota`: borra cookie `sa_restaurant_id`, redirige a `/superadmin`

### `app/dashboard/layout.tsx` (modificado)

Leer cookie `sa_restaurant_id` y nombre del restaurante. Si está activa, renderizar banner encima del contenido:

```
[Modo superadmin] Gestionando: [Nombre restaurante]   [Salir →]
```

### `app/superadmin/SuperadminRestaurantesList.tsx` (modificado)

Añadir botón "Acceder" por fila que llama a `iniciarSesionRemota(r.id)`.

### 6 archivos de actions refactorizados

Cada uno tiene una función privada local `getRestaurantId`. Se elimina y se reemplaza por `getRestaurantContext()`.

Archivos:
- `app/actions/administracion.ts`
- `app/actions/cocina.ts`
- `app/actions/onboarding.ts`
- `app/actions/productos.ts`
- `app/actions/reservas.ts`
- `app/actions/tpv.ts`

Patrón de cambio en cada acción:

**Antes:**
```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
const restaurantId = await getRestaurantId(supabase, user.id)
if (!restaurantId) redirect('/login')
```

**Después:**
```ts
const ctx = await getRestaurantContext()
if (!ctx) redirect('/login')
const { supabase, restaurantId } = ctx
```

## Seguridad

- La cookie no contiene credenciales, solo un UUID de restaurante
- En cada request, `getRestaurantContext()` verifica activamente que el usuario de la sesión actual tiene rol superadmin antes de aplicar el override
- Si un usuario no-superadmin tiene la cookie (e.g. la copiaron de otro navegador), se ignora y se usa el flujo normal
- El admin client solo se usa cuando la verificación de superadmin pasa

## Sin cambios

- Lógica de negocio de las actions (solo cambia cómo se obtiene `supabase` y `restaurantId`)
- Rutas del dashboard
- Auth middleware
- Papelera
