# Sistema de Login y Registro — Diseño

**Fecha:** 2026-05-30  
**Proyecto:** RP Restaurantes  
**Stack:** Next.js 16.2.6 · React 19 · TypeScript · Tailwind v4 · Supabase SSR

---

## Alcance

Crear el sistema de autenticación completo con:
- `lib/supabase/client.ts` — browser client
- `app/actions/auth.ts` — Server Actions de autenticación
- `app/login/` — página e formulario de inicio de sesión
- `app/registro/` — página y formulario de registro
- `app/dashboard/` — página protegida de placeholder con logout

No se tocan `lib/supabase/server.ts` ni `.env.local` ni la configuración del proyecto.

---

## Arquitectura y ficheros

```
app/
  actions/
    auth.ts               ← Server Actions ('use server' a nivel de fichero)
  login/
    page.tsx              ← Server Component — renderiza <LoginForm />
    LoginForm.tsx         ← 'use client' — formulario con useActionState
  registro/
    page.tsx              ← Server Component — renderiza <RegistroForm />
    RegistroForm.tsx      ← 'use client' — formulario con useActionState
  dashboard/
    page.tsx              ← Server Component protegido con redirect
    LogoutButton.tsx      ← 'use client' — llama a logoutAction
lib/
  supabase/
    server.ts             ← existente, sin cambios
    client.ts             ← nuevo: createBrowserClient para LogoutButton
```

### Flujo de datos

```
Usuario rellena form
  → useActionState invoca Server Action
    → Server Action llama createClient() [servidor]
      → Supabase Auth API
        → éxito: redirect() dentro de la Server Action
        → error: devuelve { error: string } → formulario lo renderiza
```

---

## Server Actions — `app/actions/auth.ts`

Fichero con `'use server'` al nivel de módulo. Exporta tres acciones.

### Tipos

```ts
type AuthState = { error?: string; success?: boolean } | undefined
```

### `loginAction(prevState: AuthState, formData: FormData): Promise<AuthState>`

1. Extrae `email` y `password` de `formData`
2. Valida: campos no vacíos, email con formato válido (regex)
3. Si inválido → `return { error: 'Mensaje descriptivo' }`
4. Llama a `supabase.auth.signInWithPassword({ email, password })`
5. Si error de Supabase → `return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }`
6. Si éxito → `redirect('/dashboard')`

### `registerAction(prevState: AuthState, formData: FormData): Promise<AuthState>`

1. Extrae: `restaurant_name`, `nif`, `name`, `email`, `password`
2. Valida: todos requeridos, email válido, contraseña ≥ 6 caracteres
3. Si inválido → `return { error: '...' }`
4. Llama a:
   ```ts
   supabase.auth.signUp({
     email,
     password,
     options: { data: { restaurant_name, nif, name } }
   })
   ```
   Las claves `restaurant_name`, `nif`, `name` son exactas — las usa un trigger de BD.
5. Si error de Supabase → `return { error: '...' }`
6. Si éxito → `return { success: true }` (no redirige; el usuario debe confirmar email)

### `logoutAction(): Promise<never>`

1. Llama a `supabase.auth.signOut()`
2. `redirect('/login')`

---

## `lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

Creado según el spec del proyecto. El `LogoutButton` usa `logoutAction` (Server Action) que a su vez usa el cliente de servidor; el `client.ts` queda disponible para futuros componentes cliente que necesiten acceder a Supabase directamente desde el browser.

---

## UI — Patrón visual compartido

**Fondo:** `bg-gray-50 min-h-screen flex items-center justify-center`

**Tarjeta:**
```
max-w-md w-full mx-auto bg-white rounded-2xl shadow-md p-8
```

**Encabezado de tarjeta:**
- Título de la app: `RP Restaurantes` (texto pequeño, gris, centrado)
- Título de la página: `Iniciar sesión` / `Crear cuenta` (h1, grande, negrita)

**Campos:**
- `<label>` encima del input
- `<input>` con `border border-gray-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500`

**Botón submit:**
- `w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50`
- Texto: `Cargando...` cuando `pending === true`

**Error global:**
- `<p className="text-red-600 text-sm text-center mt-2">{state?.error}</p>`

**Enlace al pie:**
- Login → `¿No tienes cuenta? Regístrate`
- Registro → `¿Ya tienes cuenta? Inicia sesión`

---

## Páginas en detalle

### `/login`

**`app/login/page.tsx`** — Server Component, importa y renderiza `<LoginForm />`.

**`app/login/LoginForm.tsx`** — `'use client'`
- `useActionState(loginAction, undefined)` → `[state, action, pending]`
- Campos: Email, Contraseña
- Muestra `state?.error` si existe
- Botón deshabilitado cuando `pending`

### `/registro`

**`app/registro/page.tsx`** — Server Component, importa y renderiza `<RegistroForm />`.

**`app/registro/RegistroForm.tsx`** — `'use client'`
- `useActionState(registerAction, undefined)` → `[state, action, pending]`
- Cuando `state?.success === true`: oculta el formulario, muestra panel verde con mensaje de confirmación de email
- Campos: Nombre del restaurante, NIF, Tu nombre, Email, Contraseña
- Muestra `state?.error` si existe

### `/dashboard`

**`app/dashboard/page.tsx`** — Server Component
- `const supabase = await createClient()` (servidor)
- `const { data: { user } } = await supabase.auth.getUser()`
- Si `!user` → `redirect('/login')`
- Renderiza saludo con `user.email` y el componente `<LogoutButton />`

**`app/dashboard/LogoutButton.tsx`** — `'use client'`
- Importa `logoutAction` desde `app/actions/auth`
- `<form action={logoutAction}><button type="submit">Cerrar sesión</button></form>`

---

## Manejo de errores

| Situación | Respuesta |
|-----------|-----------|
| Campo vacío | `'El campo [nombre] es obligatorio.'` |
| Email inválido | `'Introduce un email válido.'` |
| Contraseña < 6 chars | `'La contraseña debe tener al menos 6 caracteres.'` |
| Credenciales incorrectas | `'Credenciales incorrectas. Verifica tu email y contraseña.'` |
| Email ya registrado | `'Este email ya está registrado. Prueba a iniciar sesión.'` |
| Error inesperado | `'Ha ocurrido un error inesperado. Inténtalo de nuevo.'` |

---

## Consideraciones técnicas

- **Next.js 16:** `redirect()` de `next/navigation` funciona dentro de Server Actions. `useActionState` es de React 19 (ya disponible en el proyecto).
- **Tailwind v4:** no requiere `tailwind.config.js`; los estilos se aplican directamente con clases estándar.
- **TypeScript strict:** sin `any`. Los tipos de Supabase son correctos desde `@supabase/supabase-js`.
- **`proxy.ts`:** no se añade (fuera del alcance del spec); la protección de `/dashboard` es per-página via Server Component.
- **Cookies:** gestionadas automáticamente por `@supabase/ssr` en el servidor. No se necesita lógica manual de cookies.
