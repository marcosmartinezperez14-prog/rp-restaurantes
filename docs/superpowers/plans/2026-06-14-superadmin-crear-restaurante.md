# Superadmin: Crear restaurante con admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la página `/dashboard/superadmin` con un formulario que permita al operador de la plataforma dar de alta un restaurante nuevo junto con su usuario administrador.

**Architecture:** Server Action protegido por rol `superadmin` que llama al admin API de Supabase para crear el auth user (lo que dispara el trigger existente que crea `restaurants` y `users`), luego actualiza el registro con datos completos y asigna el rol `admin`. La página es un Server Component que verifica el rol antes de renderizar; el formulario es un Client Component con `useActionState`.

**Tech Stack:** Next.js 15 App Router, Supabase (admin client + SSR client), TypeScript, Tailwind CSS.

---

## Archivos

| Acción | Ruta |
|---|---|
| Crear | `app/actions/superadmin.ts` |
| Crear | `app/dashboard/superadmin/page.tsx` |
| Crear | `app/dashboard/superadmin/SuperadminForm.tsx` |

---

## Task 1: SQL — Añadir rol superadmin en Supabase

**Archivos:** ninguno en el repo (SQL directo en Supabase Dashboard)

- [ ] **Step 1: Ejecutar SQL en Supabase**

Ir a Supabase Dashboard → SQL Editor y ejecutar:

```sql
-- Añadir rol superadmin si no existe
INSERT INTO roles (id, name, description)
VALUES (gen_random_uuid(), 'superadmin', 'Operador de la plataforma RP Restaurantes')
ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 2: Asignar el rol superadmin a tu usuario operador**

Sustituye `<tu_auth_id>` por tu UUID de `auth.users` (lo ves en Supabase → Authentication → Users):

```sql
-- Obtener tu user_id y restaurant_id
SELECT u.id, u.restaurant_id FROM users u WHERE u.auth_id = '<tu_auth_id>';

-- Obtener el id del rol superadmin
SELECT id FROM roles WHERE name = 'superadmin';

-- Asignar el rol (sustituye los UUIDs obtenidos arriba)
INSERT INTO user_roles (user_id, role_id, restaurant_id)
VALUES ('<user_id>', '<superadmin_role_id>', '<restaurant_id>')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Verificar**

```sql
SELECT u.id, r.name AS rol
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.auth_id = '<tu_auth_id>';
```

Resultado esperado: al menos una fila con `rol = superadmin`.

---

## Task 2: Server Action `crearRestauranteConAdmin`

**Archivos:**
- Crear: `app/actions/superadmin.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
// app/actions/superadmin.ts
'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'

export type SuperadminActionResult =
  | { success: true; restaurante: string; usuario: string }
  | { error: string }

function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]+$/i.test(username)
}

export async function crearRestauranteConAdmin(
  _prevState: SuperadminActionResult | undefined,
  formData: FormData
): Promise<SuperadminActionResult> {
  const restaurant_name = ((formData.get('restaurant_name') as string) ?? '').trim()
  const nif = ((formData.get('nif') as string) ?? '').trim()
  const nombre = ((formData.get('nombre') as string) ?? '').trim()
  const username = ((formData.get('username') as string) ?? '').trim().toLowerCase()
  const password = (formData.get('password') as string) ?? ''

  if (!restaurant_name) return { error: 'El nombre del restaurante es obligatorio.' }
  if (!nif) return { error: 'El NIF es obligatorio.' }
  if (!nombre) return { error: 'El nombre del admin es obligatorio.' }
  if (!username) return { error: 'El usuario es obligatorio.' }
  if (!isValidUsername(username)) return { error: 'El usuario solo puede contener letras, números, guiones y guiones bajos.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }

  const email = `${username}@rp-internal.com`

  // Verificar que el username no existe ya
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return { error: 'Este nombre de usuario ya está en uso.' }

  // Crear auth user — el trigger handle_new_user crea restaurants + users automáticamente
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { restaurant_name, username, name: nombre, nif },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Error al crear el usuario en autenticación.' }
  }

  const authUserId = authData.user.id

  // Leer restaurant_id que creó el trigger
  const { data: userRecord, error: userReadError } = await supabaseAdmin
    .from('users')
    .select('restaurant_id')
    .eq('id', authUserId)
    .single()

  if (userReadError || !userRecord?.restaurant_id) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: 'El trigger no creó el restaurante. Revisa la migración 002.' }
  }

  const restaurantId = userRecord.restaurant_id

  // Actualizar el users record con datos completos (el trigger solo pone id y restaurant_id)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ auth_id: authUserId, nombre, email })
    .eq('id', authUserId)

  if (updateError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: `Error al actualizar el perfil: ${updateError.message}` }
  }

  // Asignar rol admin al nuevo usuario
  const { data: rol, error: rolError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single()

  if (rolError || !rol) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: 'Rol "admin" no encontrado en la tabla roles. Ejecuta el SQL del módulo Equipo.' }
  }

  const { error: userRoleError } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: authUserId, role_id: rol.id, restaurant_id: restaurantId })

  if (userRoleError) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId)
    return { error: `Error al asignar el rol: ${userRoleError.message}` }
  }

  return { success: true, restaurante: restaurant_name, usuario: username }
}
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores relacionados con `app/actions/superadmin.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/actions/superadmin.ts
git commit -m "feat: server action crearRestauranteConAdmin"
```

---

## Task 3: Client Component `SuperadminForm`

**Archivos:**
- Crear: `app/dashboard/superadmin/SuperadminForm.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// app/dashboard/superadmin/SuperadminForm.tsx
'use client'

import { useActionState } from 'react'
import { crearRestauranteConAdmin, type SuperadminActionResult } from '@/app/actions/superadmin'

export default function SuperadminForm() {
  const [state, action, pending] = useActionState<SuperadminActionResult | undefined, FormData>(
    crearRestauranteConAdmin,
    undefined
  )

  if (state && 'success' in state && state.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
          <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes · Superadmin</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center mb-6">
            <p className="text-green-800 font-semibold">¡Restaurante creado!</p>
            <p className="text-green-700 text-sm mt-1">
              <strong>{state.restaurante}</strong> con admin <strong>{state.usuario}</strong>
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            Crear otro restaurante
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes · Superadmin</p>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
          Crear nuevo restaurante
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-sm text-blue-800">
          ⚡ Esta acción crea el restaurante y su usuario admin directamente en producción.
        </div>

        <form action={action} className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Datos del restaurante
          </p>

          <div>
            <label htmlFor="restaurant_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del restaurante
            </label>
            <input
              id="restaurant_name"
              name="restaurant_name"
              type="text"
              placeholder="El Rincón de Madrid"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="nif" className="block text-sm font-medium text-gray-700 mb-1">
              NIF
            </label>
            <input
              id="nif"
              name="nif"
              type="text"
              placeholder="B12345678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">
            Datos del usuario admin
          </p>

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              placeholder="Juan García"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="juan_garcia"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se usará como <em>usuario@rp-internal.com</em>
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres</p>
          </div>

          {state && 'error' in state && state.error && (
            <p className="text-red-600 text-sm text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pending ? 'Creando...' : 'Crear restaurante y admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/superadmin/SuperadminForm.tsx
git commit -m "feat: SuperadminForm — formulario creación restaurante"
```

---

## Task 4: Page Server Component con protección de rol

**Archivos:**
- Crear: `app/dashboard/superadmin/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
// app/dashboard/superadmin/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SuperadminForm from './SuperadminForm'

export default async function SuperadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = userRecord?.user_roles as unknown as { roles: { name: string } | null }[]
  const isSuperadmin = roles?.some(r => r.roles?.name === 'superadmin') ?? false

  if (!isSuperadmin) redirect('/dashboard')

  return <SuperadminForm />
}
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/superadmin/page.tsx
git commit -m "feat: página /dashboard/superadmin protegida por rol superadmin"
```

---

## Task 5: Verificación manual end-to-end

- [ ] **Step 1: Arrancar el servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Step 2: Verificar protección de acceso**

Iniciar sesión con un usuario que NO tenga rol `superadmin` y navegar a `http://localhost:3000/dashboard/superadmin`.

Resultado esperado: redirige automáticamente a `/dashboard`.

- [ ] **Step 3: Verificar acceso como superadmin**

Iniciar sesión con el usuario operador (al que asignaste el rol `superadmin` en Task 1) y navegar a `http://localhost:3000/dashboard/superadmin`.

Resultado esperado: se muestra el formulario con los dos grupos de campos.

- [ ] **Step 4: Verificar validaciones**

Enviar el formulario vacío.

Resultado esperado: mensaje de error "El nombre del restaurante es obligatorio."

Enviar con contraseña de 5 caracteres.

Resultado esperado: mensaje "La contraseña debe tener al menos 8 caracteres."

Enviar con username con caracteres inválidos (ej. `juan garcia` con espacio).

Resultado esperado: mensaje "El usuario solo puede contener letras, números, guiones y guiones bajos."

- [ ] **Step 5: Verificar creación exitosa**

Rellenar el formulario con datos de prueba:
- Nombre del restaurante: `Test Restaurante`
- NIF: `B99999999`
- Nombre completo: `Test Admin`
- Usuario: `test_admin_nuevo`
- Contraseña: `test1234`

Enviar el formulario.

Resultado esperado: mensaje verde "¡Restaurante creado! **Test Restaurante** con admin **test_admin_nuevo**".

- [ ] **Step 6: Verificar en Supabase**

En Supabase Dashboard → Table Editor, verificar:

1. `auth.users` → existe `test_admin_nuevo@rp-internal.com`
2. `restaurants` → existe un registro con `name = 'Test Restaurante'`
3. `users` → existe registro con `nombre = 'Test Admin'`, `email = 'test_admin_nuevo@rp-internal.com'`, `auth_id` relleno
4. `user_roles` → el nuevo usuario tiene rol `admin`

- [ ] **Step 7: Verificar login del nuevo admin**

Abrir ventana privada, ir a `http://localhost:3000/login` e iniciar sesión con:
- Usuario: `test_admin_nuevo`
- Contraseña: `test1234`

Resultado esperado: redirige al onboarding (porque el restaurante recién creado no tiene `onboarding_completed = true`).

- [ ] **Step 8: Commit final**

```bash
git add .
git commit -m "feat: superadmin — formulario creación restaurante completo y verificado"
```
