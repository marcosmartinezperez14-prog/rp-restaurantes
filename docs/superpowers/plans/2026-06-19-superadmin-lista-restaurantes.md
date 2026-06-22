# Superadmin Lista de Restaurantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir lista de restaurantes a `/superadmin` y mover el formulario de creación a `/superadmin/nuevo`.

**Architecture:** Se añade `getRestaurantes()` a `app/actions/superadmin.ts` (5 queries al admin client, merge en JS). La página principal se convierte en server component que pasa datos a un client component de lista. El formulario se mueve a una nueva ruta `/superadmin/nuevo`.

**Tech Stack:** Next.js App Router, Supabase admin client, React server components, `useActionState`.

## Global Constraints

- Usar siempre `getSupabaseAdmin()` (bypass RLS) para queries en server actions de superadmin.
- CSS vars del proyecto: `--bg-surface`, `--bg-page`, `--text-primary`, `--text-secondary`, `--border`, `--accent`, `--accent-hover`.
- No añadir dependencias nuevas.
- Texto en negro (`text-[var(--text-primary)]`) en todos los inputs — ver globals.css.

---

### Task 1: Server action `getRestaurantes()`

**Files:**
- Modify: `app/actions/superadmin.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RestauranteResumen {
    id: string
    name: string
    nif: string | null
    created_at: string
    admin_nombre: string | null
    admin_email: string | null
    num_usuarios: number
    num_mesas: number
  }
  export async function getRestaurantes(): Promise<RestauranteResumen[] | { error: string }>
  ```

- [ ] **Step 1: Añadir tipo e implementación al final de `app/actions/superadmin.ts`**

Añadir después de la función `crearRestauranteConAdmin`:

```ts
export interface RestauranteResumen {
  id: string
  name: string
  nif: string | null
  created_at: string
  admin_nombre: string | null
  admin_email: string | null
  num_usuarios: number
  num_mesas: number
}

export async function getRestaurantes(): Promise<RestauranteResumen[] | { error: string }> {
  const supabase = await createClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return { error: 'No autenticado.' }

  const admin = getSupabaseAdmin()

  // Verificar superadmin
  const { data: callerUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', caller.id)
    .single()
  if (!callerUser) return { error: 'No autenticado.' }

  const { data: roleRows } = await admin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', callerUser.id)
  const esSuperadmin = (roleRows ?? []).some((r: any) => r.roles?.name === 'superadmin')
  if (!esSuperadmin) return { error: 'No autorizado.' }

  // Restaurantes
  const { data: restaurants, error: restError } = await admin
    .from('restaurants')
    .select('id, name, nif, created_at')
    .order('created_at', { ascending: false })
  if (restError || !restaurants) return { error: 'Error al obtener restaurantes.' }

  // Usuarios activos por restaurante
  const { data: users } = await admin
    .from('users')
    .select('restaurant_id')
    .is('deleted_at', null)

  // Mesas activas por restaurante
  const { data: tables } = await admin
    .from('tables')
    .select('restaurant_id')
    .is('deleted_at', null)

  // Admin principal por restaurante (rol 'admin')
  const { data: adminRoleRow } = await admin
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single()

  const { data: adminUserRoles } = adminRoleRow
    ? await admin
        .from('user_roles')
        .select('restaurant_id, users!user_id(nombre, email)')
        .eq('role_id', adminRoleRow.id)
    : { data: null }

  // Merge en JS
  const usersByRestaurant = new Map<string, number>()
  for (const u of users ?? []) {
    if (u.restaurant_id)
      usersByRestaurant.set(u.restaurant_id, (usersByRestaurant.get(u.restaurant_id) ?? 0) + 1)
  }

  const tablesByRestaurant = new Map<string, number>()
  for (const t of tables ?? []) {
    if (t.restaurant_id)
      tablesByRestaurant.set(t.restaurant_id, (tablesByRestaurant.get(t.restaurant_id) ?? 0) + 1)
  }

  const adminByRestaurant = new Map<string, { nombre: string | null; email: string | null }>()
  for (const ur of (adminUserRoles ?? []) as any[]) {
    if (!adminByRestaurant.has(ur.restaurant_id)) {
      adminByRestaurant.set(ur.restaurant_id, {
        nombre: ur.users?.nombre ?? null,
        email: ur.users?.email ?? null,
      })
    }
  }

  return restaurants.map(r => ({
    id: r.id,
    name: r.name,
    nif: r.nif ?? null,
    created_at: r.created_at,
    admin_nombre: adminByRestaurant.get(r.id)?.nombre ?? null,
    admin_email: adminByRestaurant.get(r.id)?.email ?? null,
    num_usuarios: usersByRestaurant.get(r.id) ?? 0,
    num_mesas: tablesByRestaurant.get(r.id) ?? 0,
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/superadmin.ts
git commit -m "feat(superadmin): add getRestaurantes server action"
```

---

### Task 2: Componente lista `SuperadminRestaurantesList.tsx`

**Files:**
- Create: `app/superadmin/SuperadminRestaurantesList.tsx`

**Interfaces:**
- Consumes: `RestauranteResumen` de `@/app/actions/superadmin`
- Props: `{ datos: RestauranteResumen[] }`

- [ ] **Step 1: Crear `app/superadmin/SuperadminRestaurantesList.tsx`**

```tsx
'use client'

import type { RestauranteResumen } from '@/app/actions/superadmin'

interface Props {
  datos: RestauranteResumen[]
}

export default function SuperadminRestaurantesList({ datos }: Props) {
  if (datos.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-2xl max-w-2xl mx-auto mt-10">
        <p className="text-3xl mb-3">🍽️</p>
        <p className="text-sm">No hay restaurantes creados todavía.</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Restaurantes</h1>
        <span className="text-xs font-medium bg-[var(--bg-page)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full">
          {datos.length} {datos.length === 1 ? 'restaurante' : 'restaurantes'}
        </span>
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-page)] border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Restaurante
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                NIF
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Admin
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Usuarios
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Mesas
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Alta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {datos.map(r => (
              <tr key={r.id} className="bg-[var(--bg-surface)] hover:bg-[var(--bg-page)] transition-colors">
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{r.name}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{r.nif ?? '—'}</td>
                <td className="px-4 py-3">
                  {r.admin_nombre ? (
                    <span className="text-[var(--text-primary)]">{r.admin_nombre}</span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{r.num_usuarios}</td>
                <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{r.num_mesas}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                  {new Date(r.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/superadmin/SuperadminRestaurantesList.tsx
git commit -m "feat(superadmin): add SuperadminRestaurantesList component"
```

---

### Task 3: Actualizar `page.tsx` principal y crear `/superadmin/nuevo`

**Files:**
- Modify: `app/superadmin/page.tsx`
- Create: `app/superadmin/nuevo/page.tsx`

**Interfaces:**
- Consumes: `getRestaurantes()` de `@/app/actions/superadmin`, `RestauranteResumen`, `SuperadminRestaurantesList`

- [ ] **Step 1: Reemplazar contenido de `app/superadmin/page.tsx`**

```tsx
import { getRestaurantes } from '@/app/actions/superadmin'
import SuperadminRestaurantesList from './SuperadminRestaurantesList'

export default async function SuperadminPage() {
  const result = await getRestaurantes()

  if ('error' in result) {
    return (
      <div className="px-6 py-8 text-center text-red-600 text-sm">
        Error: {result.error}
      </div>
    )
  }

  return <SuperadminRestaurantesList datos={result} />
}
```

- [ ] **Step 2: Crear `app/superadmin/nuevo/page.tsx`**

```tsx
import SuperadminForm from '../SuperadminForm'

export default function SuperadminNuevoPage() {
  return <SuperadminForm />
}
```

- [ ] **Step 3: Commit**

```bash
git add app/superadmin/page.tsx app/superadmin/nuevo/page.tsx
git commit -m "feat(superadmin): list page as home, form moved to /superadmin/nuevo"
```

---

### Task 4: Actualizar nav en layout y redirect de éxito en formulario

**Files:**
- Modify: `app/superadmin/layout.tsx`
- Modify: `app/superadmin/SuperadminForm.tsx`

- [ ] **Step 1: Añadir enlace "Nuevo restaurante" en `app/superadmin/layout.tsx`**

Localizar el bloque `<nav>` y añadir el enlace entre "Restaurantes" y "Papelera":

```tsx
<nav className="flex items-center gap-1">
  <Link
    href="/superadmin"
    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition-colors"
  >
    Restaurantes
  </Link>
  <Link
    href="/superadmin/nuevo"
    className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors"
  >
    + Nuevo restaurante
  </Link>
  <Link
    href="/superadmin/papelera"
    className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition-colors"
  >
    🗑️ Papelera
  </Link>
</nav>
```

- [ ] **Step 2: Actualizar el link de éxito en `app/superadmin/SuperadminForm.tsx`**

El estado de éxito muestra un `<Link href="/superadmin">Crear otro restaurante</Link>` — ya apunta a `/superadmin`. Verificar que es así; si apunta a otro sitio, corregirlo a `/superadmin`.

- [ ] **Step 3: Commit**

```bash
git add app/superadmin/layout.tsx app/superadmin/SuperadminForm.tsx
git commit -m "feat(superadmin): add 'Nuevo restaurante' nav link, fix success redirect"
```
