# Spec: Formulario de creación de admin para nuevo restaurante

**Fecha:** 2026-06-14  
**Ruta:** `/dashboard/superadmin`  
**Audiencia:** Operador de la plataforma RP Restaurantes

---

## Objetivo

Proporcionar una página dentro del dashboard desde la que el operador de la plataforma (rol `superadmin`) pueda crear un restaurante nuevo junto con su usuario administrador, sin pasar por el flujo público de `/registro` ni requerir confirmación de email.

---

## Arquitectura

### Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `app/dashboard/superadmin/page.tsx` | Página protegida; renderiza el formulario |
| `app/dashboard/superadmin/SuperadminForm.tsx` | Client component con el formulario y estado de error/éxito |
| `app/actions/superadmin.ts` | Server Action `crearRestauranteConAdmin()` |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `proxy.ts` | Añadir la ruta `/dashboard/superadmin` a la lista de rutas protegidas por rol `superadmin` |

---

## Protección de acceso

- El middleware (`proxy.ts`) ya controla el acceso por roles. Se añade una entrada que exige rol `superadmin` para `/dashboard/superadmin`.
- Si el usuario autenticado no tiene ese rol, se redirige a `/dashboard`.
- El rol `superadmin` debe existir en la tabla `roles` y asignarse manualmente al usuario operador en `user_roles`.

---

## Formulario

### Campos

**Sección "Datos del restaurante"**
- `restaurant_name` — Nombre del restaurante (obligatorio)
- `nif` — NIF del negocio (obligatorio)

**Sección "Datos del usuario admin"**
- `nombre` — Nombre completo del administrador (obligatorio)
- `username` — Nombre de usuario, solo letras/números/guiones/guiones bajos (obligatorio)
- `password` — Contraseña, mínimo 8 caracteres (obligatorio)

### Notas de UX
- Bajo el campo `username` se muestra un hint: *"Se usará como `usuario@rp-internal.com`"*
- Aviso informativo en azul al inicio del formulario: *"Esta acción crea el restaurante y su usuario admin directamente en producción."*
- Botón deshabilitado y texto "Creando..." mientras el action está en vuelo.
- En éxito: mensaje verde con el nombre del restaurante y usuario creados; el formulario se resetea para poder crear otro.

---

## Server Action — `crearRestauranteConAdmin()`

**Archivo:** `app/actions/superadmin.ts`

**Parámetros (vía FormData):** `restaurant_name`, `nif`, `nombre`, `username`, `password`

**Flujo de creación (en orden, con rollback):**

1. Validar todos los campos en servidor (mismas reglas que el formulario).
2. Verificar que el `username` no exista ya como `email` en `users`.
3. `supabaseAdmin.auth.admin.createUser({ email: username@rp-internal.com, password, email_confirm: true })` → obtener `authUser.id`.
4. `supabaseAdmin.from('restaurants').insert({ name, nif })` → obtener `restaurantId`.
5. `supabaseAdmin.from('users').insert({ id: authUser.id, auth_id: authUser.id, nombre, email, restaurant_id: restaurantId })`.
6. Buscar el `id` del rol `admin` en `roles`.
7. `supabaseAdmin.from('user_roles').insert({ user_id, role_id, restaurant_id })`.

**Rollback:** Si el paso 4 o superior falla, se llama a `supabaseAdmin.auth.admin.deleteUser(authUser.id)` antes de devolver el error.

**Retorno:** `{ success: true, restaurante: string, usuario: string } | { error: string }`

---

## Validaciones

| Campo | Regla |
|---|---|
| `restaurant_name` | No vacío |
| `nif` | No vacío |
| `nombre` | No vacío |
| `username` | `/^[a-z0-9_-]+$/i`, no vacío |
| `password` | Mínimo 8 caracteres |

---

## Fuera de alcance

- No inicia el onboarding del restaurante (zonas, mesas, carta) — eso lo hace el propio admin cuando entra por primera vez.
- No envía email de bienvenida.
- No hay listado de restaurantes creados en esta pantalla.
