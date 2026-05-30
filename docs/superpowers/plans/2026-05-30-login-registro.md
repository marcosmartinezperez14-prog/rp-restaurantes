# Login y Registro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el sistema de autenticación completo (login, registro, dashboard protegido) usando Supabase SSR y Server Actions de Next.js 16.

**Architecture:** Los formularios son Client Components que usan `useActionState` con Server Actions definidas en `app/actions/auth.ts`. Las Server Actions llaman al cliente Supabase de servidor para gestionar cookies de sesión automáticamente. El dashboard es un Server Component que redirige si no hay sesión autenticada.

**Tech Stack:** Next.js 16.2.6 · React 19 · TypeScript 5 · Tailwind v4 · @supabase/ssr v0.10.3 · @supabase/supabase-js v2

> **Nota sobre verificación:** El proyecto no tiene framework de tests configurado. La verificación de cada tarea usa `npx tsc --noEmit` (comprobación de tipos) como paso equivalente al "test fails → implement → test passes". La verificación final usa `npm run build`.

---

## File Map

| Fichero | Estado | Responsabilidad |
|---------|--------|----------------|
| `lib/supabase/client.ts` | Crear | Browser client para componentes cliente |
| `app/actions/auth.ts` | Crear | Server Actions: login, registro, logout |
| `app/login/LoginForm.tsx` | Crear | Formulario de login (`'use client'`) |
| `app/login/page.tsx` | Crear | Server Component wrapper del login |
| `app/registro/RegistroForm.tsx` | Crear | Formulario de registro (`'use client'`) |
| `app/registro/page.tsx` | Crear | Server Component wrapper del registro |
| `app/dashboard/LogoutButton.tsx` | Crear | Botón de cierre de sesión (`'use client'`) |
| `app/dashboard/page.tsx` | Crear | Dashboard protegido (Server Component) |

---

## Task 1: Browser client de Supabase

**Files:**
- Create: `lib/supabase/client.ts`

- [ ] **Step 1: Verificar que TypeScript compila limpio antes de empezar**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"
npx tsc --noEmit
```

Resultado esperado: sin errores (salida vacía).

- [ ] **Step 2: Crear `lib/supabase/client.ts`**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

- [ ] **Step 3: Verificar que TypeScript sigue compilando**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add lib/supabase/client.ts
git commit -m "feat: add supabase browser client"
```

---

## Task 2: Server Actions de autenticación

**Files:**
- Create: `app/actions/auth.ts`

- [ ] **Step 1: Crear el directorio y el fichero `app/actions/auth.ts`**

```ts
// app/actions/auth.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type AuthState = { error?: string; success?: boolean } | undefined

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!email.trim()) return { error: 'El campo email es obligatorio.' }
  if (!isValidEmail(email.trim())) return { error: 'Introduce un email válido.' }
  if (!password) return { error: 'El campo contraseña es obligatorio.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return { error: 'Credenciales incorrectas. Verifica tu email y contraseña.' }
  }

  redirect('/dashboard')
}

export async function registerAction(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const restaurant_name = (formData.get('restaurant_name') as string) ?? ''
  const nif = (formData.get('nif') as string) ?? ''
  const name = (formData.get('name') as string) ?? ''
  const email = (formData.get('email') as string) ?? ''
  const password = (formData.get('password') as string) ?? ''

  if (!restaurant_name.trim()) return { error: 'El nombre del restaurante es obligatorio.' }
  if (!nif.trim()) return { error: 'El NIF es obligatorio.' }
  if (!name.trim()) return { error: 'Tu nombre es obligatorio.' }
  if (!email.trim()) return { error: 'El campo email es obligatorio.' }
  if (!isValidEmail(email.trim())) return { error: 'Introduce un email válido.' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        restaurant_name: restaurant_name.trim(),
        nif: nif.trim(),
        name: name.trim(),
      },
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return { error: 'Este email ya está registrado. Prueba a iniciar sesión.' }
    }
    return { error: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.' }
  }

  return { success: true }
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Verificar tipos**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add app/actions/auth.ts
git commit -m "feat: add auth server actions (login, register, logout)"
```

---

## Task 3: Formulario de login

**Files:**
- Create: `app/login/LoginForm.tsx`
- Create: `app/login/page.tsx`

- [ ] **Step 1: Crear `app/login/LoginForm.tsx`**

```tsx
// app/login/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes</p>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
          Iniciar sesión
        </h1>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {state?.error && (
            <p className="text-red-600 text-sm text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pending ? 'Cargando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-blue-600 hover:underline font-medium">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `app/login/page.tsx`**

```tsx
// app/login/page.tsx
import LoginForm from './LoginForm'

export default function LoginPage() {
  return <LoginForm />
}
```

- [ ] **Step 3: Verificar tipos**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add app/login/LoginForm.tsx app/login/page.tsx
git commit -m "feat: add login page with form and server action"
```

---

## Task 4: Formulario de registro

**Files:**
- Create: `app/registro/RegistroForm.tsx`
- Create: `app/registro/page.tsx`

- [ ] **Step 1: Crear `app/registro/RegistroForm.tsx`**

```tsx
// app/registro/RegistroForm.tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions/auth'

export default function RegistroForm() {
  const [state, action, pending] = useActionState(registerAction, undefined)

  if (state?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
          <p className="text-center text-sm text-gray-500 mb-4">RP Restaurantes</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 font-medium">¡Registro exitoso!</p>
            <p className="text-green-700 text-sm mt-1">
              Revisa tu email para confirmar tu cuenta antes de iniciar sesión.
            </p>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <p className="text-center text-sm text-gray-500 mb-1">RP Restaurantes</p>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
          Crear cuenta
        </h1>

        <form action={action} className="space-y-4">
          <div>
            <label
              htmlFor="restaurant_name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nombre del restaurante
            </label>
            <input
              id="restaurant_name"
              name="restaurant_name"
              type="text"
              placeholder="Mi Restaurante"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="nif"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              NIF
            </label>
            <input
              id="nif"
              name="nif"
              type="text"
              placeholder="B12345678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tu nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Juan García"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {state?.error && (
            <p className="text-red-600 text-sm text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {pending ? 'Cargando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crear `app/registro/page.tsx`**

```tsx
// app/registro/page.tsx
import RegistroForm from './RegistroForm'

export default function RegistroPage() {
  return <RegistroForm />
}
```

- [ ] **Step 3: Verificar tipos**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add app/registro/RegistroForm.tsx app/registro/page.tsx
git commit -m "feat: add registro page with form and server action"
```

---

## Task 5: Dashboard protegido con logout

**Files:**
- Create: `app/dashboard/LogoutButton.tsx`
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Crear `app/dashboard/LogoutButton.tsx`**

```tsx
// app/dashboard/LogoutButton.tsx
'use client'

import { logoutAction } from '@/app/actions/auth'

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
      >
        Cerrar sesión
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Crear `app/dashboard/page.tsx`**

```tsx
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
        <p className="text-sm text-gray-500 mb-1">RP Restaurantes</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel de control</h1>
        <p className="text-gray-600 mb-6">
          Bienvenido,{' '}
          <span className="font-medium text-gray-800">{user.email}</span>
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

```powershell
npx tsc --noEmit
```

Resultado esperado: sin errores.

- [ ] **Step 4: Commit**

```powershell
git add app/dashboard/LogoutButton.tsx app/dashboard/page.tsx
git commit -m "feat: add protected dashboard with logout"
```

---

## Task 6: Verificación final de build

- [ ] **Step 1: Ejecutar build de producción**

```powershell
npm run build
```

Resultado esperado: build completado sin errores. Verás líneas como:
```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                   ...
├ ○ /dashboard                          ...
├ ○ /login                              ...
└ ○ /registro                           ...
```

Si el build falla con un error de módulo no encontrado o de tipos, revisa el fichero indicado en el error antes de continuar.

- [ ] **Step 2: Arrancar dev server y probar flujo completo**

```powershell
npm run dev
```

Abrir `http://localhost:3000` en el navegador y verificar:

| Acción | Resultado esperado |
|--------|--------------------|
| Ir a `/login` | Se muestra la tarjeta de login centrada |
| Enviar el formulario vacío | Aparece error "El campo email es obligatorio." |
| Introducir email inválido | Aparece error "Introduce un email válido." |
| Login con credenciales incorrectas | Aparece error "Credenciales incorrectas..." |
| Login con credenciales correctas | Redirige a `/dashboard` |
| Ir a `/dashboard` sin sesión | Redirige a `/login` |
| En `/dashboard` con sesión | Se muestra el email del usuario |
| Pulsar "Cerrar sesión" | Redirige a `/login` |
| Ir a `/registro` | Se muestra el formulario de 5 campos |
| Enviar registro con email ya usado | Aparece error "Este email ya está registrado..." |
| Completar registro exitoso | Se muestra el panel verde de confirmación |

- [ ] **Step 3: Commit final**

```powershell
git add -A
git commit -m "chore: verify full auth flow build"
```

---

## Self-Review

### Spec coverage

| Requisito del spec | Tarea que lo implementa |
|--------------------|------------------------|
| `lib/supabase/client.ts` con `createBrowserClient` | Task 1 |
| Login con email/contraseña, validación, loading, errores en español | Task 3 |
| Login redirige a `/dashboard` | Task 2 (`loginAction`) |
| Enlace a registro desde login | Task 3 |
| Registro con 5 campos, `options.data` con claves exactas | Task 2 (`registerAction`) |
| Mensaje de éxito registro → confirmar email | Task 4 |
| Enlace a login desde registro | Task 4 |
| Dashboard Server Component, redirect si no hay usuario | Task 5 |
| Saludo con email del usuario | Task 5 |
| Botón logout `'use client'` + redirect a `/login` | Task 5 |
| Diseño coherente tipo tarjeta, Tailwind, textos en español | Tasks 3, 4, 5 |
| TypeScript sin `any` | Todas las tareas usan tipos explícitos |

### Tipos consistentes en todo el plan

- `AuthState = { error?: string; success?: boolean } | undefined` — definido en Task 2, usado en Tasks 3 y 4 vía `useActionState`
- `loginAction`, `registerAction`, `logoutAction` — definidos en Task 2, importados en Tasks 3, 4, 5
- `createClient` del servidor — importado desde `@/lib/supabase/server` (existente)
- `createClient` del browser — definido en Task 1, disponible en `@/lib/supabase/client`
