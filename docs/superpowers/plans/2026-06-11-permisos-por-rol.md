# Permisos por Rol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de permisos por rol configurable desde la UI: qué módulos puede ver cada rol en cada restaurante, persistido en base de datos y aplicado en runtime en el sidebar y las rutas.

**Architecture:** Capa DB (`permisos_rol` table + RPC `get_permisos_usuario_actual`) sobre el sistema estático `PERMISOS_POR_ROL` existente. El nuevo hook `usePermisos` (lib/permisos/) reemplaza el estático `hooks/usePermisos.ts` para lectura dinámica. La UI de configuración es una tabla/tabs por rol con toggles optimistas. NavDrawer filtra items con el nuevo hook. `RutaProtegida` gana prop `moduloKey` opcional para verificación DB adicional.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS + RPC), TypeScript, Tailwind CSS, sessionStorage cache (TTL 5 min)

---

## CRÍTICO: Hallazgos de exploración del codebase

Antes de tocar nada, tener SIEMPRE presente:

- **`PERMISOS_POR_ROL`** está en `types/equipo.ts` (líneas 17-53). NO modificar — los componentes existentes dependen de él. El nuevo sistema DB convive con él.
- **`RutaProtegida`** está en `components/auth/RutaProtegida.tsx`. Props actuales: `{ rol: RolNombre | null, modulo: string, children: ReactNode }`. Le añadiremos `moduloKey?: string` opcional.
- **`NavDrawer`** está en `components/NavDrawer.tsx`. Muestra todos los items sin filtrar, usa emojis (no lucide-react). Le añadiremos filtrado con `usePermisos`.
- **`hooks/usePermisos.ts`** (existente) toma `rol` como parámetro y usa `PERMISOS_POR_ROL` estático. NO eliminar — muchos componentes lo usan. El nuevo hook está en `lib/permisos/usePermisos.ts` (path diferente).
- **FK de tabla**: usar `restaurants(id)` — NO `restaurantes(id)`.
- **`user_roles`** tiene columnas: `user_id`, `role_id`, `restaurant_id`. Join con `users` vía `users.id = user_roles.user_id`, NO `auth_id`.
- **Roles**: 'admin', 'gerente', 'camarero', 'cocinero', 'contable'. Admin siempre acceso total.
- **Dashboard home** (`app/dashboard/page.tsx`) filtra NAV_CARDS server-side vía `PERMISOS_POR_ROL`. No tocar ese filtrado — añadiremos solo la card de Permisos.
- **Patron de obtención del rol** (en TODAS las pages server-side):
  ```typescript
  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()
  const roles = userData?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  ```

---

## Mapa de archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| MANUAL | Supabase SQL Editor | Task 0: tabla permisos_rol + RPC |
| CREAR | `lib/permisos/modulos.ts` | Catálogo canónico de módulos del sistema |
| CREAR | `types/permisos.ts` | Tipos TypeScript del sistema de permisos |
| CREAR | `app/api/permisos/mios/route.ts` | GET permisos del usuario actual (para hook) |
| CREAR | `app/api/permisos/rol/route.ts` | GET matriz completa + POST upsert permiso |
| CREAR | `lib/permisos/usePermisos.ts` | Hook React con caché sessionStorage |
| CREAR | `app/dashboard/permisos/page.tsx` | Page Server Component con auth guard |
| CREAR | `components/permisos/ConfiguracionPermisos.tsx` | UI matriz de toggles por rol |
| MODIFICAR | `components/NavDrawer.tsx` | Filtrar items + añadir link Permisos |
| MODIFICAR | `components/auth/RutaProtegida.tsx` | Añadir prop `moduloKey` opcional |
| MODIFICAR | `app/dashboard/page.tsx` | Añadir card Permisos para admin/gerente |

---

## Task 0: SQL — tabla permisos_rol + RPC (MANUAL)

**Archivos:** ninguno — SQL a ejecutar en Supabase → SQL Editor

- [ ] **Step 1: Ejecutar SQL de creación**

```sql
-- Tabla de permisos por rol por restaurante
CREATE TABLE IF NOT EXISTS permisos_rol (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  modulo_key    TEXT NOT NULL,
  activo        BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES users(id),
  UNIQUE(restaurant_id, role_id, modulo_key)
);

CREATE INDEX IF NOT EXISTS idx_permisos_rol_restaurant
  ON permisos_rol(restaurant_id, role_id);

ALTER TABLE permisos_rol ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permisos_rol_select" ON permisos_rol
  FOR SELECT USING (restaurant_id = get_current_restaurant_id());

CREATE POLICY "permisos_rol_write" ON permisos_rol
  FOR ALL USING (
    restaurant_id = get_current_restaurant_id()
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid()
        AND ur.restaurant_id = get_current_restaurant_id()
        AND r.name IN ('admin','gerente')
    )
  );
```

- [ ] **Step 2: Crear RPC get_permisos_usuario_actual**

```sql
CREATE OR REPLACE FUNCTION get_permisos_usuario_actual()
RETURNS TABLE (modulo_key TEXT, activo BOOLEAN)
LANGUAGE sql STABLE AS $$
  SELECT
    m.modulo_key,
    COALESCE(pr.activo, true) AS activo
  FROM (
    SELECT unnest(ARRAY[
      'tpv','carta','cocina','reservas','finanzas','informes',
      'equipo','personal','negocio','caja','fichaje','permisos'
    ]) AS modulo_key
  ) m
  LEFT JOIN user_roles ur ON (
    ur.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
    AND ur.restaurant_id = get_current_restaurant_id()
  )
  LEFT JOIN permisos_rol pr ON (
    pr.role_id = ur.role_id
    AND pr.modulo_key = m.modulo_key
    AND pr.restaurant_id = get_current_restaurant_id()
  );
$$;

GRANT EXECUTE ON FUNCTION get_permisos_usuario_actual TO authenticated;
```

- [ ] **Step 3: Verificar**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'permisos_rol';

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_permisos_usuario_actual';
```

Resultado esperado: 1 tabla + 1 función.

---

## Task 1: Catálogo de módulos

**Archivos:**
- Crear: `lib/permisos/modulos.ts`

- [ ] **Step 1: Crear lib/permisos/modulos.ts**

```typescript
export interface ModuloSistema {
  key: string
  label: string
  ruta: string
  descripcion: string
  icono: string
  protegible: boolean
}

export const MODULOS_SISTEMA: ModuloSistema[] = [
  { key: 'tpv',      label: 'TPV',        ruta: '/tpv',                  descripcion: 'Terminal punto de venta y gestión de mesas',  icono: '🖥️',  protegible: true },
  { key: 'carta',    label: 'Carta',       ruta: '/productos',            descripcion: 'Inventario, stock y gestión de carta',         icono: '📦',  protegible: true },
  { key: 'cocina',   label: 'Cocina',      ruta: '/cocina',               descripcion: 'Platos pendientes y en preparación',           icono: '🍳',  protegible: true },
  { key: 'reservas', label: 'Reservas',    ruta: '/reservas',             descripcion: 'Gestión de reservas del día',                 icono: '📅',  protegible: true },
  { key: 'finanzas', label: 'Finanzas',    ruta: '/dashboard/finanzas',   descripcion: 'Ingresos, gastos y beneficio',                icono: '💰',  protegible: true },
  { key: 'informes', label: 'Informes',    ruta: '/dashboard/informes',   descripcion: 'Ventas, productos y franjas horarias',         icono: '📊',  protegible: true },
  { key: 'equipo',   label: 'Equipo',      ruta: '/dashboard/equipo',     descripcion: 'Usuarios, roles y permisos',                  icono: '👥',  protegible: true },
  { key: 'personal', label: 'Personal',    ruta: '/dashboard/personal',   descripcion: 'Turnos, vacaciones y días libres',            icono: '🗓️',  protegible: true },
  { key: 'negocio',  label: 'Mi negocio',  ruta: '/dashboard/negocio',    descripcion: 'KPIs del día en un vistazo',                  icono: '🏪',  protegible: true },
  { key: 'caja',     label: 'Caja',        ruta: '/dashboard/caja',       descripcion: 'Turnos, apertura y cierre de caja',           icono: '🏦',  protegible: true },
  { key: 'fichaje',  label: 'Fichaje',     ruta: '/dashboard/fichaje',    descripcion: 'Registro de entrada y salida de jornada',     icono: '⏱️',  protegible: false },
  { key: 'permisos', label: 'Permisos',    ruta: '/dashboard/permisos',   descripcion: 'Configuración de acceso por rol',             icono: '🔐',  protegible: true },
]

export const MODULOS_SIEMPRE_ACTIVOS = ['fichaje']
export const ROLES_PROTEGIDOS = ['admin']
export const SOLO_ADMIN_PUEDE_CONFIGURAR = ['gerente']
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "modulos"
```

Resultado esperado: sin errores.

- [ ] **Step 3: Commit**

```powershell
git add lib/permisos/modulos.ts
git commit -m "feat: catálogo de módulos del sistema para permisos"
```

---

## Task 2: Tipos TypeScript

**Archivos:**
- Crear: `types/permisos.ts`

- [ ] **Step 1: Crear types/permisos.ts**

```typescript
export interface PermisoRol {
  id: string
  restaurant_id: string
  role_id: string
  modulo_key: string
  activo: boolean
  updated_at: string
  updated_by: string | null
}

export interface PermisosUsuario {
  [modulo_key: string]: boolean
}

export interface MatrizPermisos {
  role_id: string
  role_name: string
  permisos: {
    [modulo_key: string]: boolean
  }
}

export interface RespuestaMios {
  rol: string | null
  permisos: PermisosUsuario
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "permisos"
```

- [ ] **Step 3: Commit**

```powershell
git add types/permisos.ts
git commit -m "feat: tipos TypeScript para sistema de permisos"
```

---

## Task 3: API GET /api/permisos/mios

**Archivos:**
- Crear: `app/api/permisos/mios/route.ts`

Esta ruta devuelve los permisos del usuario actual (desde RPC) junto con su rol (para que NavDrawer sepa si mostrar el link de Permisos).

- [ ] **Step 1: Crear app/api/permisos/mios/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RespuestaMios } from '@/types/permisos'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const [{ data: userData }, { data: rows, error }] = await Promise.all([
    supabase
      .from('users')
      .select('user_roles!user_id(roles(name))')
      .eq('auth_id', user.id)
      .single(),
    supabase.rpc('get_permisos_usuario_actual'),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rolesData = userData?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = rolesData?.[0]?.roles?.name ?? null

  const permisos: Record<string, boolean> = {}
  for (const row of (rows ?? [])) {
    permisos[row.modulo_key] = row.activo
  }

  // Admin siempre tiene acceso a todo
  if (rol === 'admin') {
    for (const key of Object.keys(permisos)) {
      permisos[key] = true
    }
  }

  const respuesta: RespuestaMios = { rol, permisos }
  return NextResponse.json(respuesta)
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "mios"
```

- [ ] **Step 3: Commit**

```powershell
git add app/api/permisos/mios/route.ts
git commit -m "feat: API GET /api/permisos/mios devuelve permisos y rol del usuario"
```

---

## Task 4: API /api/permisos/rol (GET matriz + POST upsert)

**Archivos:**
- Crear: `app/api/permisos/rol/route.ts`

- [ ] **Step 1: Crear app/api/permisos/rol/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { MatrizPermisos } from '@/types/permisos'
import { MODULOS_SISTEMA, MODULOS_SIEMPRE_ACTIVOS, ROLES_PROTEGIDOS, SOLO_ADMIN_PUEDE_CONFIGURAR } from '@/lib/permisos/modulos'

async function getCallerInfo(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData) return null
  const rolesData = userData.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = rolesData?.[0]?.roles?.name ?? null
  return { userId: userData.id, restaurantId: userData.restaurant_id, rol }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  // Cargar todos los roles del sistema
  const { data: roles } = await supabaseAdmin
    .from('roles')
    .select('id, name')
    .order('name')

  // Cargar permisos configurados para este restaurante
  const { data: permisos } = await supabaseAdmin
    .from('permisos_rol')
    .select('role_id, modulo_key, activo')
    .eq('restaurant_id', caller.restaurantId)

  const permisosMap = new Map<string, boolean>()
  for (const p of (permisos ?? [])) {
    permisosMap.set(`${p.role_id}:${p.modulo_key}`, p.activo)
  }

  const modulosProtegibles = MODULOS_SISTEMA.filter(m => m.protegible)

  const matriz: MatrizPermisos[] = (roles ?? []).map(role => {
    const permisosPorModulo: Record<string, boolean> = {}
    for (const modulo of modulosProtegibles) {
      const key = `${role.id}:${modulo.key}`
      permisosPorModulo[modulo.key] = permisosMap.get(key) ?? true
    }
    // Admin siempre tiene todo activo
    if (role.name === 'admin') {
      for (const modulo of modulosProtegibles) {
        permisosPorModulo[modulo.key] = true
      }
    }
    return { role_id: role.id, role_name: role.name, permisos: permisosPorModulo }
  })

  return NextResponse.json({ data: matriz })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const caller = await getCallerInfo(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as { role_id: string; modulo_key: string; activo: boolean }
  const { role_id, modulo_key, activo } = body

  if (!role_id || !modulo_key || typeof activo !== 'boolean') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Verificar que el rol existe y obtener su nombre
  const { data: roleData } = await supabaseAdmin
    .from('roles')
    .select('name')
    .eq('id', role_id)
    .single()

  if (!roleData) return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })

  // Validaciones de seguridad
  if (ROLES_PROTEGIDOS.includes(roleData.name)) {
    return NextResponse.json({ error: 'El rol admin no es configurable' }, { status: 403 })
  }
  if (caller.rol === 'gerente' && SOLO_ADMIN_PUEDE_CONFIGURAR.includes(roleData.name)) {
    return NextResponse.json({ error: 'Solo admin puede configurar permisos del gerente' }, { status: 403 })
  }
  if (MODULOS_SIEMPRE_ACTIVOS.includes(modulo_key)) {
    return NextResponse.json({ error: 'Este módulo no se puede desactivar' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('permisos_rol')
    .upsert({
      restaurant_id: caller.restaurantId,
      role_id,
      modulo_key,
      activo,
      updated_by: caller.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'restaurant_id,role_id,modulo_key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "permisos/rol"
```

- [ ] **Step 3: Commit**

```powershell
git add app/api/permisos/rol/route.ts
git commit -m "feat: API permisos/rol — GET matriz completa y POST upsert con validaciones"
```

---

## Task 5: Hook usePermisos (lib/permisos/)

**Archivos:**
- Crear: `lib/permisos/usePermisos.ts`

IMPORTANTE: Este hook va en `lib/permisos/usePermisos.ts`, NO en `hooks/usePermisos.ts` (que ya existe y es diferente — toma `rol` como param).

- [ ] **Step 1: Crear lib/permisos/usePermisos.ts**

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { PermisosUsuario, RespuestaMios } from '@/types/permisos'

const CACHE_KEY = 'rp_permisos_usuario'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

interface CacheEntry {
  timestamp: number
  data: RespuestaMios
}

function leerCache(): RespuestaMios | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

function escribirCache(data: RespuestaMios) {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

export function limpiarCachePermisos() {
  try { sessionStorage.removeItem(CACHE_KEY) } catch {}
}

export function usePermisos() {
  const [permisos, setPermisos] = useState<PermisosUsuario>({})
  const [rol, setRol] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = leerCache()
    if (cached) {
      setRol(cached.rol)
      setPermisos(cached.permisos)
      setLoading(false)
      return
    }

    fetch('/api/permisos/mios')
      .then(r => r.json())
      .then((data: RespuestaMios) => {
        escribirCache(data)
        setRol(data.rol)
        setPermisos(data.permisos)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function tieneAcceso(modulo_key: string): boolean {
    // Default permissive: si no hay datos aún o no hay restricción, permitir
    if (loading) return true
    if (!(modulo_key in permisos)) return true
    return permisos[modulo_key] !== false
  }

  return { permisos, rol, loading, tieneAcceso }
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "usePermisos"
```

- [ ] **Step 3: Commit**

```powershell
git add lib/permisos/usePermisos.ts
git commit -m "feat: hook usePermisos con caché sessionStorage 5 min"
```

---

## Task 6: Page Server Component /dashboard/permisos

**Archivos:**
- Crear: `app/dashboard/permisos/page.tsx`

- [ ] **Step 1: Crear app/dashboard/permisos/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import ConfiguracionPermisos from '@/components/permisos/ConfiguracionPermisos'
import type { RolNombre } from '@/types/equipo'

export default async function PermisosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  const roles = userData?.user_roles as unknown as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null

  if (rol !== 'admin' && rol !== 'gerente') redirect('/dashboard')

  return (
    <AppShell title="Permisos">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Configuración de permisos</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Los cambios se aplican inmediatamente. Los usuarios afectados verán el nuevo acceso en su próxima navegación (caché de 5 minutos).
          </p>
        </div>
        <ConfiguracionPermisos rolUsuarioActual={rol as 'admin' | 'gerente'} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "permisos/page"
```

- [ ] **Step 3: Commit**

```powershell
git add app/dashboard/permisos/page.tsx
git commit -m "feat: page /dashboard/permisos con guard admin/gerente"
```

---

## Task 7: ConfiguracionPermisos — UI matriz de toggles

**Archivos:**
- Crear: `components/permisos/ConfiguracionPermisos.tsx`

- [ ] **Step 1: Crear components/permisos/ConfiguracionPermisos.tsx**

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { MatrizPermisos } from '@/types/permisos'
import { MODULOS_SISTEMA, MODULOS_SIEMPRE_ACTIVOS, ROLES_PROTEGIDOS, SOLO_ADMIN_PUEDE_CONFIGURAR } from '@/lib/permisos/modulos'

interface Props {
  rolUsuarioActual: 'admin' | 'gerente'
}

const ORDEN_ROLES = ['admin', 'gerente', 'camarero', 'cocinero', 'contable']

export default function ConfiguracionPermisos({ rolUsuarioActual }: Props) {
  const [matriz, setMatriz] = useState<MatrizPermisos[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabActivo, setTabActivo] = useState<string | null>(null)
  // guardando: roleId:moduloKey -> true mientras se persiste
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/permisos/rol')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        const ordenada = [...(data.data as MatrizPermisos[])].sort(
          (a, b) => ORDEN_ROLES.indexOf(a.role_name) - ORDEN_ROLES.indexOf(b.role_name)
        )
        setMatriz(ordenada)
        // Tab inicial: primer rol configurable
        const configurables = getRolesConfigurables(ordenada)
        if (configurables.length > 0) setTabActivo(configurables[0].role_name)
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setCargando(false))
  }, [])

  function getRolesConfigurables(m: MatrizPermisos[]): MatrizPermisos[] {
    return m.filter(r => {
      if (ROLES_PROTEGIDOS.includes(r.role_name)) return false
      if (rolUsuarioActual === 'gerente' && SOLO_ADMIN_PUEDE_CONFIGURAR.includes(r.role_name)) return false
      return true
    })
  }

  async function handleToggle(roleId: string, roleName: string, moduloKey: string, nuevoActivo: boolean) {
    const guardandoKey = `${roleId}:${moduloKey}`

    // Actualización optimista
    setMatriz(prev => prev.map(r =>
      r.role_id === roleId
        ? { ...r, permisos: { ...r.permisos, [moduloKey]: nuevoActivo } }
        : r
    ))

    setGuardando(prev => ({ ...prev, [guardandoKey]: true }))

    try {
      const res = await fetch('/api/permisos/rol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId, modulo_key: moduloKey, activo: nuevoActivo }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        // Revertir
        setMatriz(prev => prev.map(r =>
          r.role_id === roleId
            ? { ...r, permisos: { ...r.permisos, [moduloKey]: !nuevoActivo } }
            : r
        ))
        setError(data.error ?? 'Error al guardar')
        return
      }
      setMensajeGuardado('Guardado')
      setTimeout(() => setMensajeGuardado(null), 2000)
    } catch {
      // Revertir
      setMatriz(prev => prev.map(r =>
        r.role_id === roleId
          ? { ...r, permisos: { ...r.permisos, [moduloKey]: !nuevoActivo } }
          : r
      ))
      setError('Error de conexión')
    } finally {
      setGuardando(prev => ({ ...prev, [guardandoKey]: false }))
    }
  }

  if (cargando) return <p className="text-sm text-[var(--text-secondary)]">Cargando...</p>
  if (error) return <p className="text-sm text-red-500">{error}</p>

  const modulosProtegibles = MODULOS_SISTEMA.filter(m => m.protegible)
  const rolesConfigurables = getRolesConfigurables(matriz)
  const rolActivo = matriz.find(r => r.role_name === tabActivo)

  return (
    <div className="flex flex-col gap-4">
      {/* Feedback */}
      {mensajeGuardado && (
        <div className="text-sm text-green-600 font-medium">{mensajeGuardado}</div>
      )}

      {/* Fila admin — siempre visible, no configurable */}
      {matriz.find(r => r.role_name === 'admin') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
          <span className="text-base">🛡️</span>
          <div className="flex-1">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Administrador</span>
            <span className="ml-2 text-xs text-[var(--text-secondary)] italic">Acceso total — no configurable</span>
          </div>
        </div>
      )}

      {/* Tabs de roles configurables */}
      <div className="flex gap-1 border-b border-[var(--border)] pb-0">
        {rolesConfigurables.map(r => (
          <button
            key={r.role_id}
            onClick={() => setTabActivo(r.role_name)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tabActivo === r.role_name
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
            }`}
          >
            {r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabla de módulos */}
      {rolActivo && (
        <div className="flex flex-col gap-2">
          {modulosProtegibles.map(modulo => {
            const activo = rolActivo.permisos[modulo.key] ?? true
            const siempreActivo = MODULOS_SIEMPRE_ACTIVOS.includes(modulo.key)
            const guardandoEste = guardando[`${rolActivo.role_id}:${modulo.key}`] ?? false
            const disabled = siempreActivo || guardandoEste

            return (
              <div
                key={modulo.key}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]"
              >
                <span className="text-xl flex-shrink-0">{modulo.icono}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{modulo.label}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{modulo.descripcion}</p>
                  {siempreActivo && (
                    <p className="text-xs text-[var(--text-secondary)] italic">🔒 Obligatorio para todos los roles</p>
                  )}
                </div>
                <div className="flex-shrink-0 relative">
                  {guardandoEste && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button
                    role="switch"
                    aria-checked={activo}
                    disabled={disabled}
                    onClick={() => !disabled && handleToggle(rolActivo.role_id, rolActivo.role_name, modulo.key, !activo)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${activo ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        activo ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "ConfiguracionPermisos"
```

- [ ] **Step 3: Commit**

```powershell
git add components/permisos/ConfiguracionPermisos.tsx
git commit -m "feat: ConfiguracionPermisos — tabla de toggles por rol con actualización optimista"
```

---

## Task 8: Actualizar NavDrawer

**Archivos:**
- Modificar: `components/NavDrawer.tsx`

El NavDrawer actual muestra todos los items sin filtrar. Hay que:
1. Llamar al nuevo `usePermisos` (de `lib/permisos/usePermisos.ts`)
2. Filtrar items que tienen `moduloKey` definido según `tieneAcceso`
3. Añadir link "Permisos" visible solo para admin y gerente

El NavDrawer usa emojis (no lucide-react). Los items actuales y sus `moduloKey`:
```
/dashboard → (no filtrar, siempre visible)
/dashboard/negocio → 'negocio'
/tpv → 'tpv'
/reservas → 'reservas'
/productos → 'carta'
/dashboard/informes → 'informes'
/dashboard/personal → 'personal'
/dashboard/fichaje → 'fichaje' (protegible: false → siempre mostrar)
/dashboard/caja → 'caja'
```

- [ ] **Step 1: Reemplazar contenido de components/NavDrawer.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/actions/auth'
import { getFailed } from '@/lib/offline/db'
import FailedOperations from '@/components/offline/FailedOperations'
import { usePermisos } from '@/lib/permisos/usePermisos'
import { MODULOS_SIEMPRE_ACTIVOS } from '@/lib/permisos/modulos'

type NavItem = {
  href: string
  label: string
  icon: string
  moduloKey?: string  // undefined = siempre visible
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',          label: 'Inicio',     icon: '🏠' },
  { href: '/dashboard/negocio',  label: 'Mi negocio', icon: '🏪', moduloKey: 'negocio' },
  { href: '/tpv',                label: 'TPV',         icon: '🖥️', moduloKey: 'tpv' },
  { href: '/reservas',           label: 'Reservas',    icon: '📅', moduloKey: 'reservas' },
  { href: '/productos',          label: 'Carta',       icon: '📦', moduloKey: 'carta' },
  { href: '/dashboard/informes', label: 'Informes',    icon: '📊', moduloKey: 'informes' },
  { href: '/dashboard/personal', label: 'Personal',    icon: '🗓️', moduloKey: 'personal' },
  { href: '/dashboard/fichaje',  label: 'Fichaje',     icon: '⏱️', moduloKey: 'fichaje' },
  { href: '/dashboard/caja',     label: 'Caja',        icon: '🏦', moduloKey: 'caja' },
]

export default function NavDrawer() {
  const [open, setOpen] = useState(false)
  const [failedCount, setFailedCount] = useState(0)
  const [showFailed, setShowFailed] = useState(false)
  const pathname = usePathname()
  const { tieneAcceso, rol } = usePermisos()

  useEffect(() => {
    getFailed().then(ops => setFailedCount(ops.length)).catch(() => {})
  }, [])

  const itemsVisibles = NAV_ITEMS.filter(item => {
    if (!item.moduloKey) return true
    // Módulos siempre activos (fichaje) siempre se muestran
    if (MODULOS_SIEMPRE_ACTIVOS.includes(item.moduloKey)) return true
    return tieneAcceso(item.moduloKey)
  })

  const esAdminOGerente = rol === 'admin' || rol === 'gerente'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex flex-col justify-center gap-[5px] w-8 h-8 rounded-lg hover:bg-slate-100 items-center flex-shrink-0"
      >
        <span className="block w-5 h-[2px] bg-[#64748b] rounded-full" />
        <span className="block w-5 h-[2px] bg-[#64748b] rounded-full" />
        <span className="block w-5 h-[2px] bg-[#64748b] rounded-full" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-52 bg-white z-50 flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#64748b] uppercase tracking-widest">RP Restaurantes</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="text-[#94a3b8] hover:text-[#64748b] text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">
              {itemsVisibles.map(item => {
                const active = item.href === '/dashboard'
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-[#64748b] hover:bg-slate-100 hover:text-[#0f172a]'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
              {esAdminOGerente && (
                <Link
                  href="/dashboard/permisos"
                  onClick={() => setOpen(false)}
                  aria-current={pathname.startsWith('/dashboard/permisos') ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    pathname.startsWith('/dashboard/permisos')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-[#64748b] hover:bg-slate-100 hover:text-[#0f172a]'
                  }`}
                >
                  <span aria-hidden="true">🔐</span>
                  Permisos
                </Link>
              )}
            </nav>
            <div className="px-3 py-3 border-t border-[#e2e8f0] flex flex-col gap-1">
              {failedCount > 0 && (
                <button
                  onClick={() => setShowFailed(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  ⚠️ {failedCount} op. fallidas
                </button>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  🚪 Cerrar sesión
                </button>
              </form>
            </div>
          </aside>
        </>
      )}
      {showFailed && (
        <FailedOperations
          onClose={() => {
            setShowFailed(false)
            getFailed().then(ops => setFailedCount(ops.length)).catch(() => {})
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "NavDrawer"
```

- [ ] **Step 3: Commit**

```powershell
git add components/NavDrawer.tsx
git commit -m "feat: NavDrawer filtra items por permisos DB y añade link Permisos para admin/gerente"
```

---

## Task 9: Actualizar RutaProtegida

**Archivos:**
- Modificar: `components/auth/RutaProtegida.tsx`

Añadir prop opcional `moduloKey`. Si se provee, ADEMÁS del check estático (PERMISOS_POR_ROL), verifica el permiso DB via `usePermisos`. La verificación DB es no-bloqueante durante el loading (optimistic = true hasta que carguen permisos).

- [ ] **Step 1: Leer el archivo actual**

Leer `components/auth/RutaProtegida.tsx` para verificar el contenido antes de editar.

- [ ] **Step 2: Reemplazar contenido de components/auth/RutaProtegida.tsx**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { RolNombre, PERMISOS_POR_ROL } from '@/types/equipo'
import { usePermisos } from '@/lib/permisos/usePermisos'

interface Props {
  rol: RolNombre | null
  modulo: string
  moduloKey?: string   // clave del nuevo sistema DB (opcional)
  children: React.ReactNode
}

export default function RutaProtegida({ rol, modulo, moduloKey, children }: Props) {
  const router = useRouter()
  const { tieneAcceso, loading } = usePermisos()

  const tieneAccesoEstatico = rol ? (PERMISOS_POR_ROL[rol]?.modulos.includes(modulo) ?? false) : false
  const tieneAccesoDB = moduloKey ? tieneAcceso(moduloKey) : true
  const accesoConcedido = tieneAccesoEstatico && tieneAccesoDB

  useEffect(() => {
    // Solo redirigir cuando los permisos DB ya cargaron (evitar redirigir por estado loading)
    if (!tieneAccesoEstatico) {
      router.replace('/dashboard')
      return
    }
    if (!loading && moduloKey && !tieneAcceso(moduloKey)) {
      router.replace('/dashboard')
    }
  }, [tieneAccesoEstatico, loading, moduloKey, tieneAcceso, router])

  if (!tieneAccesoEstatico) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748b]">No tienes permisos para acceder a esta sección.</p>
      </div>
    )
  }

  // Durante la carga de permisos DB, mostrar contenido (optimistic)
  if (loading && moduloKey) return <>{children}</>

  if (!accesoConcedido) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#64748b]">No tienes acceso a este módulo.</p>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Verificar compilación**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1 | Select-String "RutaProtegida"
```

- [ ] **Step 4: Commit**

```powershell
git add components/auth/RutaProtegida.tsx
git commit -m "feat: RutaProtegida añade verificación de permisos DB vía moduloKey opcional"
```

---

## Task 10: Añadir card Permisos al dashboard + build final

**Archivos:**
- Modificar: `app/dashboard/page.tsx`

Añadir la card de Permisos al dashboard home, visible solo para admin y gerente. Usar el mismo patrón de NAV_CARDS existente.

- [ ] **Step 1: Leer app/dashboard/page.tsx**

Leer el archivo para ubicar el array NAV_CARDS y la lógica de filtrado.

- [ ] **Step 2: Añadir card Permisos al array NAV_CARDS**

Añadir este objeto al final del array NAV_CARDS (antes del cierre `]`):

```typescript
  {
    href: '/dashboard/permisos',
    icon: '🔐',
    label: 'Permisos',
    description: 'Configura el acceso por rol',
    color: 'bg-[var(--bg-surface)] border-rose-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-rose-500/15',
    labelColor: 'text-rose-600',
    modulo: 'administracion',
  },
```

También añadir 'administracion' a los módulos de admin y gerente en `PERMISOS_POR_ROL` si no está ya. **Verificar primero**: abrir `types/equipo.ts` y ver si 'administracion' ya está en los módulos de admin y gerente — si no está, añadirlo.

- [ ] **Step 3: Verificar compilación completa**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npx tsc --noEmit 2>&1
```

Resultado esperado: 0 errores.

- [ ] **Step 4: Build completo**

```powershell
cd "C:\Proyectoa RP resturantes\rp-restaurantes"; npm run build 2>&1 | tail -20
```

Resultado esperado: `✓ Compiled successfully`.

- [ ] **Step 5: Commit final**

```powershell
git add app/dashboard/page.tsx
git commit -m "feat: card Permisos en dashboard home para admin/gerente"
```

- [ ] **Step 6: Push**

```powershell
git push origin master 2>&1
```

---

## Self-Review

**Spec coverage:**
- ✅ PASO 0: SQL exploración documentado en hallazgos críticos
- ✅ PASO 1: `lib/permisos/modulos.ts` con MODULOS_SISTEMA ajustado a rutas reales (Task 1)
- ✅ PASO 2: SQL tabla `permisos_rol` + RLS + índices (Task 0)
- ✅ PASO 3: RPC `get_permisos_usuario_actual` (Task 0)
- ✅ PASO 4: `types/permisos.ts` con PermisoRol, PermisosUsuario, MatrizPermisos (Task 2)
- ✅ PASO 5: `lib/permisos/usePermisos.ts` con caché sessionStorage TTL 5 min (Task 5)
- ✅ PASO 6: API `/api/permisos/mios` GET (Task 3)
- ✅ PASO 6: API `/api/permisos/rol` GET + POST con validaciones (Task 4)
- ✅ PASO 7: `app/dashboard/permisos/page.tsx` Server Component con guard (Task 6)
- ✅ PASO 8: `ConfiguracionPermisos.tsx` con tabs, toggles, optimistic updates, feedback (Task 7)
- ✅ PASO 9: NavDrawer filtrado + link Permisos para admin/gerente (Task 8)
- ✅ PASO 9: RutaProtegida con `moduloKey` opcional (Task 9)
- ✅ PASO 10: Card Permisos en dashboard home (Task 10)
- ✅ Admin siempre acceso total (forzado en API GET /mios y en matriz del GET /rol)
- ✅ Default permissive: COALESCE(pr.activo, true) en RPC + tieneAcceso devuelve true si no hay dato
- ✅ Gerente no puede modificar permisos de admin ni gerente (validación en POST)
- ✅ MODULOS_SIEMPRE_ACTIVOS no se pueden desactivar (validación en POST + disabled en UI)
- ✅ Verificación de autorización en servidor (API routes), no solo en cliente
- ✅ PERMISOS_POR_ROL existente NO modificado (sigue funcionando en paralelo)
- ✅ Caché TTL documentado en aviso de la UI

**Placeholder scan:** Ninguno — todos los pasos tienen código completo.

**Type consistency:**
- `MatrizPermisos.role_name` — usado consistentemente en Tasks 4, 7
- `RespuestaMios.rol` y `.permisos` — consistente en Tasks 3, 5
- `ModuloSistema.key` — los mismos keys en modulos.ts, RPC SQL, y NavDrawer
- `MODULOS_SIEMPRE_ACTIVOS`, `ROLES_PROTEGIDOS`, `SOLO_ADMIN_PUEDE_CONFIGURAR` — importados consistentemente desde `lib/permisos/modulos.ts`
- `tieneAcceso(modulo_key: string): boolean` — firma consistente en Tasks 5, 8, 9
