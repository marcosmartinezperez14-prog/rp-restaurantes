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

Ninguno — la protección y la lógica son autocontenidas en los archivos nuevos.

---

## Protección de acceso

- `proxy.ts` no hace control de roles — solo verifica autenticación y onboarding. La protección va en `app/dashboard/superadmin/page.tsx` como Server Component.
- Al cargar la página se consulta `user_roles` para verificar que el usuario tiene rol `superadmin`. Si no, se hace `redirect('/dashboard')`.
- El rol `superadmin` no existe aún en la tabla `roles`. Hay que añadirlo con SQL antes de implementar:
  ```sql
  INSERT INTO roles (id, name, description)
  VALUES (gen_random_uuid(), 'superadmin', 'Operador de la plataforma RP Restaurantes')
  ON CONFLICT (name) DO NOTHING;
  ```
- Asignar manualmente el rol `superadmin` al usuario operador en `user_roles`.

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

### Nota sobre el trigger de Supabase

El trigger `handle_new_user` (migration `002`) se dispara automáticamente al crear un usuario en `auth.users`. Hace:
- `INSERT INTO restaurants (name) VALUES (user_metadata.restaurant_name)` → crea el restaurante
- `INSERT INTO users (id, restaurant_id) VALUES (NEW.id, restaurant_id)` → crea el registro básico de usuario

Por tanto, el Server Action **no hace INSERT en `restaurants` ni en `users`**. En su lugar hace un UPDATE al registro que ya creó el trigger.

**Flujo de creación (en orden, con rollback):**

1. Validar todos los campos en servidor (mismas reglas que el formulario).
2. Verificar que el `username` no exista ya en `auth.users` consultando si hay un `users` con ese `email`.
3. `supabaseAdmin.auth.admin.createUser({ email: username@rp-internal.com, password, email_confirm: true, user_metadata: { restaurant_name, username, name: nombre, nif } })` → el trigger crea `restaurants` y `users` automáticamente.
4. Leer el `restaurant_id` del registro `users` recién creado (`users.id = authUser.id`).
5. `supabaseAdmin.from('users').update({ auth_id: authUser.id, nombre, email }).eq('id', authUser.id)`.
6. Buscar el `id` del rol `admin` en `roles`.
7. `supabaseAdmin.from('user_roles').insert({ user_id: authUser.id, role_id, restaurant_id })`.

**NIF:** No hay columna `nif` en `restaurants`. Se almacena en `user_metadata` del auth user (paso 3) y estará disponible para completar en el panel de negocio tras el onboarding.

**Rollback:** Si el paso 4 o superior falla, se llama a `supabaseAdmin.auth.admin.deleteUser(authUser.id)` antes de devolver el error (esto también eliminará el registro en `users` y `restaurants` creados por el trigger si se configuró cascade, o quedarán huérfanos — aceptable en un flujo de error interno).

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
