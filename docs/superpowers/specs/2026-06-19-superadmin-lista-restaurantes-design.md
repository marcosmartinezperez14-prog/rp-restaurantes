---
title: Superadmin — Lista de restaurantes en página principal
date: 2026-06-19
status: approved
---

## Objetivo

Convertir `/superadmin` en una vista de lista de todos los restaurantes existentes, moviendo el formulario de creación a `/superadmin/nuevo`.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/superadmin` | Lista de restaurantes (nueva página principal) |
| `/superadmin/nuevo` | Formulario de creación (movido) |
| `/superadmin/papelera` | Sin cambios |

## Datos por restaurante

Query con admin client (bypass RLS) sobre `restaurants`, con:
- `id`, `name`, `nif`, `created_at`
- Usuario admin principal: primer `user` del restaurante con rol `admin` → `nombre` y `email`
- Conteo de usuarios activos (`users` con `deleted_at IS NULL`)
- Conteo de mesas activas (`tables` con `deleted_at IS NULL`)

## Server Action

`getRestaurantes()` en `app/actions/superadmin.ts`:
- Usa `getSupabaseAdmin()`
- Verifica que el caller es superadmin antes de devolver datos
- Devuelve array de `RestauranteResumen[]` o `{ error: string }`

```ts
interface RestauranteResumen {
  id: string
  name: string
  nif: string | null
  created_at: string
  admin_nombre: string | null
  admin_email: string | null
  num_usuarios: number
  num_mesas: number
}
```

## Componentes

### `app/superadmin/page.tsx` (server component)
Llama a `getRestaurantes()` y renderiza `<SuperadminRestaurantesList datos={...} />`.

### `app/superadmin/SuperadminRestaurantesList.tsx` (client component)
Tabla con columnas: Restaurante, NIF, Admin, Usuarios, Mesas, Fecha alta.
Estado vacío si no hay restaurantes.

### `app/superadmin/nuevo/page.tsx` (nuevo)
Solo renderiza `<SuperadminForm />`.

### `app/superadmin/layout.tsx` (modificado)
Añadir enlace "Nuevo restaurante" en la nav junto a "Restaurantes" y "Papelera".

### `app/superadmin/SuperadminForm.tsx` (modificado mínimo)
El link "Crear otro restaurante" en el estado de éxito apunta a `/superadmin` (ya lo hace — sin cambios necesarios).

## Seguridad

- `getRestaurantes()` verifica rol superadmin con admin client antes de devolver datos.
- El layout ya protege toda la ruta `/superadmin`.

## Sin cambios

- Lógica de `crearRestauranteConAdmin`
- Papelera
- Autenticación / middleware
