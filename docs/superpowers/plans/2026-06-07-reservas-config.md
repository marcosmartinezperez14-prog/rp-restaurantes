# Configuración de Reservas + Sección Administración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al admin/gerente configurar días, horarios, duración y confirmación de reservas, con validación en la API pública y botón "Confirmar" en el dashboard para reservas pendientes.

**Architecture:** Nueva tabla `reservation_settings` (JSONB para schedule), server action para leer/guardar, panel de configuración en nueva sección Administración, integración con API pública de reservas y lista de reservas del dashboard.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Tailwind CSS

---

## Archivos a crear/modificar

| Acción | Ruta |
|---|---|
| CREAR | `SQL_RESERVAS_CONFIG.md` |
| MODIFICAR | `types/equipo.ts` |
| CREAR | `app/actions/administracion.ts` |
| CREAR | `app/dashboard/administracion/page.tsx` |
| CREAR | `components/administracion/ReservasConfigPanel.tsx` |
| MODIFICAR | `app/dashboard/page.tsx` |
| MODIFICAR | `app/actions/reservas.ts` |
| MODIFICAR | `components/reservas/ReservationsList.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/reservas/route.ts` |
| MODIFICAR | `app/cliente/[slug]/reservas/page.tsx` |

---

## Task 1: SQL — tabla reservation_settings

**Files:**
- Create: `SQL_RESERVAS_CONFIG.md`

- [ ] **Step 1: Crear el archivo SQL de referencia**

Crear `SQL_RESERVAS_CONFIG.md` en la raíz del proyecto con este contenido exacto:

```markdown
# SQL — Tabla reservation_settings

Ejecuta en el SQL Editor de Supabase:

```sql
CREATE TABLE IF NOT EXISTS reservation_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE,
  auto_confirm     BOOLEAN NOT NULL DEFAULT true,
  duration_minutes INT NOT NULL DEFAULT 90,
  schedule         JSONB NOT NULL DEFAULT '{
    "lunes":     { "activo": true,  "apertura": "13:00", "cierre": "23:30" },
    "martes":    { "activo": true,  "apertura": "13:00", "cierre": "23:30" },
    "miercoles": { "activo": true,  "apertura": "13:00", "cierre": "23:30" },
    "jueves":    { "activo": true,  "apertura": "13:00", "cierre": "23:30" },
    "viernes":   { "activo": true,  "apertura": "13:00", "cierre": "23:30" },
    "sabado":    { "activo": true,  "apertura": "13:00", "cierre": "23:30" },
    "domingo":   { "activo": false, "apertura": "13:00", "cierre": "23:30" }
  }'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reservation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_isolation" ON reservation_settings
  USING (restaurant_id = get_current_restaurant_id());
```
```

- [ ] **Step 2: Ejecutar el SQL en Supabase**

Ir a Supabase Dashboard → SQL Editor y ejecutar el SQL del archivo anterior.
Verificar: `SELECT * FROM reservation_settings;` debe devolver 0 filas (tabla vacía, correcto).

- [ ] **Step 3: Commit**

```bash
git add SQL_RESERVAS_CONFIG.md
git commit -m "docs: SQL tabla reservation_settings"
```

---

## Task 2: Tipos TypeScript y permisos de rol

**Files:**
- Modify: `types/equipo.ts`

- [ ] **Step 1: Añadir `administracion` a los módulos de admin y gerente**

En `types/equipo.ts`, modificar `PERMISOS_POR_ROL`:

```typescript
export type RolNombre = 'admin' | 'gerente' | 'camarero' | 'cocinero' | 'contable'

export interface UsuarioEquipo {
  id: string
  auth_id: string
  nombre: string
  email: string
  avatar_url: string | null
  activo: boolean
  created_at: string
  rol: RolNombre
  user_role_id: string
}

export const ROLES_EDITORES: RolNombre[] = ['admin', 'gerente']

export const PERMISOS_POR_ROL: Record<RolNombre, {
  label: string
  color: string
  descripcion: string
  modulos: string[]
}> = {
  admin: {
    label: 'Administrador',
    color: 'purple',
    descripcion: 'Acceso total al sistema',
    modulos: ['dashboard', 'tpv', 'pedidos', 'productos', 'finanzas', 'facturas', 'equipo', 'personal', 'configuracion', 'administracion'],
  },
  gerente: {
    label: 'Gerente',
    color: 'blue',
    descripcion: 'Todo menos configuración crítica',
    modulos: ['dashboard', 'tpv', 'pedidos', 'productos', 'finanzas', 'facturas', 'equipo', 'personal', 'administracion'],
  },
  camarero: {
    label: 'Camarero',
    color: 'green',
    descripcion: 'Solo TPV y pedidos',
    modulos: ['tpv', 'pedidos', 'personal'],
  },
  cocinero: {
    label: 'Cocinero',
    color: 'orange',
    descripcion: 'Solo visualización de pedidos',
    modulos: ['pedidos', 'personal'],
  },
  contable: {
    label: 'Contable',
    color: 'yellow',
    descripcion: 'Solo finanzas y facturas',
    modulos: ['finanzas', 'facturas', 'personal'],
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add types/equipo.ts
git commit -m "feat: añadir módulo administracion a permisos de admin y gerente"
```

---

## Task 3: Server actions de administración

**Files:**
- Create: `app/actions/administracion.ts`

- [ ] **Step 1: Crear el archivo**

Crear `app/actions/administracion.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type DiaSchedule = {
  activo: boolean
  apertura: string
  cierre: string
}

export type Schedule = {
  lunes: DiaSchedule
  martes: DiaSchedule
  miercoles: DiaSchedule
  jueves: DiaSchedule
  viernes: DiaSchedule
  sabado: DiaSchedule
  domingo: DiaSchedule
}

export type ReservasConfig = {
  auto_confirm: boolean
  duration_minutes: number
  schedule: Schedule
}

const DEFAULT_SCHEDULE: Schedule = {
  lunes:     { activo: true,  apertura: '13:00', cierre: '23:30' },
  martes:    { activo: true,  apertura: '13:00', cierre: '23:30' },
  miercoles: { activo: true,  apertura: '13:00', cierre: '23:30' },
  jueves:    { activo: true,  apertura: '13:00', cierre: '23:30' },
  viernes:   { activo: true,  apertura: '13:00', cierre: '23:30' },
  sabado:    { activo: true,  apertura: '13:00', cierre: '23:30' },
  domingo:   { activo: false, apertura: '13:00', cierre: '23:30' },
}

export const DEFAULT_CONFIG: ReservasConfig = {
  auto_confirm: true,
  duration_minutes: 90,
  schedule: DEFAULT_SCHEDULE,
}

async function getRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>, authId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', authId)
    .single()
  return data?.restaurant_id ?? null
}

export async function getReservasConfig(): Promise<ReservasConfig> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) redirect('/login')

  const { data } = await supabase
    .from('reservation_settings')
    .select('auto_confirm, duration_minutes, schedule')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!data) return DEFAULT_CONFIG

  return {
    auto_confirm: data.auto_confirm,
    duration_minutes: data.duration_minutes,
    schedule: data.schedule as Schedule,
  }
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t)
}

export async function guardarReservasConfig(config: ReservasConfig): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const restaurantId = await getRestaurantId(supabase, user.id)
  if (!restaurantId) return { error: 'Restaurante no encontrado' }

  if (config.duration_minutes < 15 || config.duration_minutes > 480) {
    return { error: 'La duración debe estar entre 15 y 480 minutos' }
  }

  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
  for (const dia of dias) {
    const d = config.schedule[dia]
    if (d.activo) {
      if (!isValidTime(d.apertura) || !isValidTime(d.cierre)) {
        return { error: `Horario inválido para ${dia}` }
      }
      if (d.apertura >= d.cierre) {
        return { error: `La hora de cierre debe ser posterior a la apertura (${dia})` }
      }
    }
  }

  const { error } = await supabase
    .from('reservation_settings')
    .upsert(
      {
        restaurant_id: restaurantId,
        auto_confirm: config.auto_confirm,
        duration_minutes: config.duration_minutes,
        schedule: config.schedule,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'restaurant_id' }
    )

  if (error) return { error: error.message }
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/administracion.ts
git commit -m "feat: server actions getReservasConfig y guardarReservasConfig"
```

---

## Task 4: Panel de configuración de reservas

**Files:**
- Create: `components/administracion/ReservasConfigPanel.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/administracion/ReservasConfigPanel.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import type { ReservasConfig, Schedule, DiaSchedule } from '@/app/actions/administracion'
import { guardarReservasConfig } from '@/app/actions/administracion'

const DIAS: { key: keyof Schedule; label: string }[] = [
  { key: 'lunes',     label: 'Lunes' },
  { key: 'martes',    label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves',    label: 'Jueves' },
  { key: 'viernes',   label: 'Viernes' },
  { key: 'sabado',    label: 'Sábado' },
  { key: 'domingo',   label: 'Domingo' },
]

function formatDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export default function ReservasConfigPanel({ initialConfig }: { initialConfig: ReservasConfig }) {
  const [config, setConfig] = useState<ReservasConfig>(initialConfig)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function setDia(key: keyof Schedule, partial: Partial<DiaSchedule>) {
    setConfig(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [key]: { ...prev.schedule[key], ...partial },
      },
    }))
  }

  function handleGuardar() {
    setError(null)
    setGuardado(false)
    startTransition(async () => {
      const res = await guardarReservasConfig(config)
      if (res.error) { setError(res.error); return }
      setGuardado(true)
    })
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-6">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">Configuración de reservas</h2>

      {/* Horario por día */}
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Horario de reservas</p>
        <div className="space-y-3">
          {DIAS.map(({ key, label }) => {
            const dia = config.schedule[key]
            return (
              <div key={key} className="flex items-center gap-4 py-2 border-b border-[var(--border)] last:border-0">
                {/* Toggle activo */}
                <button
                  onClick={() => setDia(key, { activo: !dia.activo })}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${dia.activo ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dia.activo ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>

                {/* Nombre del día */}
                <span className={`text-sm w-24 flex-shrink-0 ${dia.activo ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                  {label}
                </span>

                {dia.activo ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={dia.apertura}
                      onChange={e => setDia(key, { apertura: e.target.value })}
                      className="border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">hasta</span>
                    <input
                      type="time"
                      value={dia.cierre}
                      onChange={e => setDia(key, { cierre: e.target.value })}
                      className="border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">Cerrado</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Duración estimada */}
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Duración estimada por reserva</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={config.duration_minutes}
            onChange={e => setConfig(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
            className="w-24 border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-[var(--text-secondary)]">minutos</span>
          <span className="text-sm text-[var(--text-primary)] font-medium">
            ({formatDuracion(config.duration_minutes)})
          </span>
        </div>
      </div>

      {/* Confirmación automática */}
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Confirmación de reservas</p>
        <div className="flex items-start gap-3">
          <button
            onClick={() => setConfig(prev => ({ ...prev, auto_confirm: !prev.auto_confirm }))}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${config.auto_confirm ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.auto_confirm ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
          <div>
            <p className="text-sm text-[var(--text-primary)] font-medium">
              {config.auto_confirm ? 'Confirmación automática' : 'Confirmación manual'}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {config.auto_confirm
                ? 'Las reservas públicas se confirman al instante'
                : 'Las reservas llegan como pendientes y el staff las confirma manualmente'}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}
      {guardado && (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">Configuración guardada correctamente.</p>
      )}

      {/* Botón guardar */}
      <button
        onClick={handleGuardar}
        disabled={isPending}
        className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
      >
        {isPending ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/administracion/ReservasConfigPanel.tsx
git commit -m "feat: ReservasConfigPanel con horario, duración y confirmación"
```

---

## Task 5: Página de Administración

**Files:**
- Create: `app/dashboard/administracion/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/dashboard/administracion/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { getReservasConfig } from '@/app/actions/administracion'
import ReservasConfigPanel from '@/components/administracion/ReservasConfigPanel'

export default async function AdministracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const config = await getReservasConfig()

  return (
    <AppShell title="Administración">
      <div className="max-w-2xl mx-auto space-y-6">
        <ReservasConfigPanel initialConfig={config} />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/administracion/page.tsx
git commit -m "feat: página de administración con configuración de reservas"
```

---

## Task 6: Tarjeta Administración en el menú principal

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Añadir la tarjeta al array NAV_CARDS**

En `app/dashboard/page.tsx`, añadir al array `NAV_CARDS` (después de la tarjeta de Configuración):

```typescript
{
  href: '/dashboard/administracion',
  icon: '🔧',
  label: 'Administración',
  description: 'Reservas, horarios y configuración avanzada',
  color: 'bg-[var(--bg-surface)] border-rose-500/40 hover:bg-[var(--bg-surface-hover)]',
  iconBg: 'bg-rose-500/15',
  labelColor: 'text-rose-600',
  modulo: 'administracion',
},
```

El array `NAV_CARDS` completo quedará:

```typescript
const NAV_CARDS = [
  {
    href: '/tpv',
    icon: '🖥️',
    label: 'TPV',
    description: 'Mesas, comandas y cobros',
    color: 'bg-[var(--bg-surface)] border-blue-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-blue-500/15',
    labelColor: 'text-blue-600',
    modulo: 'tpv',
  },
  {
    href: '/reservas',
    icon: '📅',
    label: 'Reservas',
    description: 'Gestión de reservas del día',
    color: 'bg-[var(--bg-surface)] border-violet-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-violet-500/15',
    labelColor: 'text-violet-600',
    modulo: 'pedidos',
  },
  {
    href: '/productos',
    icon: '📦',
    label: 'Productos',
    description: 'Inventario, stock y carta',
    color: 'bg-[var(--bg-surface)] border-emerald-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-emerald-500/15',
    labelColor: 'text-emerald-600',
    modulo: 'productos',
  },
  {
    href: '/dashboard/finanzas',
    icon: '💰',
    label: 'Finanzas',
    description: 'Ingresos, gastos y beneficio',
    color: 'bg-[var(--bg-surface)] border-orange-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-orange-500/15',
    labelColor: 'text-orange-600',
    modulo: 'finanzas',
  },
  {
    href: '/cocina',
    icon: '🍳',
    label: 'Cocina',
    description: 'Platos pendientes y en preparación',
    color: 'bg-[var(--bg-surface)] border-red-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-red-500/15',
    labelColor: 'text-red-600',
    modulo: 'pedidos',
  },
  {
    href: '/dashboard/equipo',
    icon: '👥',
    label: 'Equipo',
    description: 'Usuarios, roles y permisos',
    color: 'bg-[var(--bg-surface)] border-purple-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-purple-500/15',
    labelColor: 'text-purple-600',
    modulo: 'equipo',
  },
  {
    href: '/dashboard/personal',
    icon: '🗓️',
    label: 'Personal',
    description: 'Turnos, vacaciones y días libres',
    color: 'bg-[var(--bg-surface)] border-teal-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-teal-500/15',
    labelColor: 'text-teal-600',
    modulo: 'personal',
  },
  {
    href: '/dashboard/configuracion',
    icon: '⚙️',
    label: 'Configuración',
    description: 'Apariencia y preferencias',
    color: 'bg-[var(--bg-surface)] border-slate-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-slate-500/15',
    labelColor: 'text-slate-600',
    modulo: 'configuracion',
  },
  {
    href: '/dashboard/administracion',
    icon: '🔧',
    label: 'Administración',
    description: 'Reservas, horarios y configuración avanzada',
    color: 'bg-[var(--bg-surface)] border-rose-500/40 hover:bg-[var(--bg-surface-hover)]',
    iconBg: 'bg-rose-500/15',
    labelColor: 'text-rose-600',
    modulo: 'administracion',
  },
]
```

- [ ] **Step 2: Verificar que `configuracion` sigue siendo visible solo para admin**

La lógica de filtrado existente (`cardsVisibles`) ya filtra por `modulosPermitidos`. Como `administracion` solo está en admin y gerente, solo ellos verán la tarjeta. No hay cambio de lógica necesario.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: tarjeta Administración en el menú principal del dashboard"
```

---

## Task 7: Soporte de `pending` en el dashboard de reservas

**Files:**
- Modify: `app/actions/reservas.ts`
- Modify: `components/reservas/ReservationsList.tsx`

- [ ] **Step 1: Añadir `pending` al tipo `ReservationStatus`**

En `app/actions/reservas.ts`, cambiar la línea 8:

```typescript
export type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show' | 'pending'
```

- [ ] **Step 2: Actualizar STATUS_CONFIG y NEXT_STATUSES en ReservationsList**

En `components/reservas/ReservationsList.tsx`, añadir `pending` a los objetos de configuración:

```typescript
const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',     color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmada',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  seated:    { label: 'Sentada',       color: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Completada',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelada',     color: 'bg-red-50 text-red-600 border-red-200' },
  no_show:   { label: 'No presentado', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const NEXT_STATUSES: Record<ReservationStatus, ReservationStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated:    ['completed', 'cancelled'],
  completed: [],
  cancelled: ['confirmed'],
  no_show:   ['confirmed'],
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmada',
  seated:    'Sentar',
  completed: 'Completar',
  cancelled: 'Cancelar',
  no_show:   'No presentado',
}
```

- [ ] **Step 3: Verificar que el botón de transición aparece**

Las reservas `pending` mostrarán dos botones: "Confirmar" y "Cancelar" (que son `confirmed` y `cancelled` en `NEXT_STATUSES.pending`). El componente ya usa `NEXT_STATUSES` para renderizar botones, así que no se necesita código adicional.

- [ ] **Step 4: Commit**

```bash
git add app/actions/reservas.ts components/reservas/ReservationsList.tsx
git commit -m "feat: soporte de reservas pendientes en el dashboard"
```

---

## Task 8: Integración de la configuración en la API pública

**Files:**
- Modify: `app/api/cliente/[slug]/reservas/route.ts`

- [ ] **Step 1: Actualizar la ruta POST**

Reemplazar el contenido completo de `app/api/cliente/[slug]/reservas/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Schedule } from '@/app/actions/administracion'

const DIA_MAP: Record<number, keyof Schedule> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await req.json()
    const { nombre_cliente, telefono, fecha, hora, num_personas, notas } = body

    if (!nombre_cliente?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    if (!telefono?.trim()) return NextResponse.json({ error: 'El teléfono es obligatorio' }, { status: 400 })
    if (!fecha) return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 })
    if (!hora) return NextResponse.json({ error: 'La hora es obligatoria' }, { status: 400 })
    if (!num_personas || num_personas < 1) return NextResponse.json({ error: 'El número de personas debe ser al menos 1' }, { status: 400 })

    const today = new Date().toISOString().split('T')[0]
    if (fecha < today) return NextResponse.json({ error: 'La fecha no puede ser en el pasado' }, { status: 400 })

    const { data: restaurante } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!restaurante) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    // Consultar configuración de reservas
    const { data: settings } = await supabaseAdmin
      .from('reservation_settings')
      .select('auto_confirm, schedule')
      .eq('restaurant_id', restaurante.id)
      .maybeSingle()

    let autoConfirm = true

    if (settings) {
      const schedule = settings.schedule as Schedule
      autoConfirm = settings.auto_confirm

      // Validar día de la semana
      const [anio, mes, dia] = fecha.split('-').map(Number)
      const diaSemana = new Date(anio, mes - 1, dia).getDay()
      const diaKey = DIA_MAP[diaSemana]
      const diaConfig = schedule[diaKey]

      if (!diaConfig.activo) {
        return NextResponse.json({ error: 'El restaurante no acepta reservas ese día' }, { status: 400 })
      }

      if (hora < diaConfig.apertura || hora >= diaConfig.cierre) {
        return NextResponse.json({ error: `Fuera del horario de reservas (${diaConfig.apertura}–${diaConfig.cierre})` }, { status: 400 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert({
        restaurant_id: restaurante.id,
        customer_name: nombre_cliente.trim(),
        customer_phone: telefono.trim(),
        customer_email: null,
        party_size: Number(num_personas),
        reservation_date: fecha,
        reservation_time: hora,
        status: autoConfirm ? 'confirmed' : 'pending',
        notes: notas?.trim() || null,
      })
      .select('id')
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'No se pudo crear la reserva' }, { status: 500 })

    return NextResponse.json({ ok: true, id: data.id, auto_confirm: autoConfirm })
  } catch {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/cliente/
git commit -m "feat: validar horario de reservas y status pending/confirmed según configuración"
```

---

## Task 9: Mensaje de confirmación en el formulario público

**Files:**
- Modify: `app/cliente/[slug]/reservas/page.tsx`

- [ ] **Step 1: Añadir estado `autoConfirm` y actualizar la pantalla de éxito**

En `app/cliente/[slug]/reservas/page.tsx`, añadir el estado `autoConfirm` y actualizar `handleEnviar` y la pantalla de confirmación.

Localiza el bloque de estado al inicio del componente y añade:
```typescript
const [autoConfirm, setAutoConfirm] = useState(true)
```

En `handleEnviar`, después de verificar `res.ok`, capturar `auto_confirm`:
```typescript
const data = await res.json()
if (!res.ok) { setError(data.error ?? 'No se pudo realizar la reserva'); return }
setAutoConfirm(data.auto_confirm !== false)
setEnviado(true)
```

Actualizar la pantalla de confirmación (bloque `if (enviado)`):
```typescript
if (enviado) {
  return (
    <div className="max-w-md mx-auto px-4 py-12 text-center">
      <div className="text-5xl mb-4">{autoConfirm ? '✓' : '🕐'}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {autoConfirm ? '¡Reserva confirmada!' : 'Reserva recibida'}
      </h2>
      <p className="text-gray-500 text-sm">
        {autoConfirm
          ? <>Te esperamos el {fecha.split('-').reverse().join('/')} a las {hora}h.<br />Nos pondremos en contacto si necesitamos confirmar.</>
          : 'Te confirmaremos lo antes posible.'}
      </p>
      <a
        href={`/cliente/${slug}`}
        className="inline-block mt-6 px-4 py-2 text-sm text-blue-600 underline"
      >
        Ver la carta
      </a>
    </div>
  )
}
```

El archivo completo resultante de `app/cliente/[slug]/reservas/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function ReservasPage() {
  const params = useParams()
  const slug = params.slug as string

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [numPersonas, setNumPersonas] = useState(2)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [autoConfirm, setAutoConfirm] = useState(true)

  const hoy = new Date().toISOString().split('T')[0]

  async function handleEnviar() {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (!fecha) { setError('La fecha es obligatoria'); return }
    if (!hora) { setError('La hora es obligatoria'); return }
    if (numPersonas < 1) { setError('El número de personas debe ser al menos 1'); return }

    setEnviando(true)
    try {
      const res = await fetch(`/api/cliente/${slug}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_cliente: nombre,
          telefono,
          fecha,
          hora,
          num_personas: numPersonas,
          notas: notas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudo realizar la reserva'); return }
      setAutoConfirm(data.auto_confirm !== false)
      setEnviado(true)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">{autoConfirm ? '✓' : '🕐'}</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {autoConfirm ? '¡Reserva confirmada!' : 'Reserva recibida'}
        </h2>
        <p className="text-gray-500 text-sm">
          {autoConfirm
            ? <>Te esperamos el {fecha.split('-').reverse().join('/')} a las {hora}h.<br />Nos pondremos en contacto si necesitamos confirmar.</>
            : 'Te confirmaremos lo antes posible.'}
        </p>
        <a
          href={`/cliente/${slug}`}
          className="inline-block mt-6 px-4 py-2 text-sm text-blue-600 underline"
        >
          Ver la carta
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/cliente/${slug}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          ←
        </a>
        <h1 className="text-xl font-bold text-gray-900">Reservar mesa</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre completo"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="tel"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="600 000 000"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              min={hoy}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setNumPersonas(p => Math.max(1, p - 1))}
              className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
            >
              −
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[2rem] text-center">
              {numPersonas}
            </span>
            <button
              onClick={() => setNumPersonas(p => p + 1)}
              className="w-10 h-10 rounded-full border border-gray-300 text-gray-700 text-lg font-bold flex items-center justify-center hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Alergias, cumpleaños, preferencias..."
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          onClick={handleEnviar}
          disabled={enviando}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {enviando ? 'Enviando...' : 'Confirmar reserva'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/cliente/
git commit -m "feat: mensaje de confirmación adaptado según auto_confirm del restaurante"
```

---

## Self-Review

**Spec coverage:**
- ✅ SQL tabla `reservation_settings`
- ✅ Tipos TypeScript `DiaSchedule`, `Schedule`, `ReservasConfig`
- ✅ `PERMISOS_POR_ROL` actualizado con `administracion` para admin y gerente
- ✅ Server actions `getReservasConfig` y `guardarReservasConfig` con validaciones
- ✅ `ReservasConfigPanel` con horario por día, duración y toggle de confirmación
- ✅ Página `/dashboard/administracion`
- ✅ Tarjeta Administración en el menú principal
- ✅ `pending` en `ReservationStatus`, `STATUS_CONFIG`, `NEXT_STATUSES`, `STATUS_LABELS`
- ✅ API pública valida día/hora contra `reservation_settings` y asigna `status` correcto
- ✅ Devuelve `auto_confirm` en respuesta de la API
- ✅ Formulario público muestra mensaje diferente según `auto_confirm`
- ✅ Si no hay configuración, comportamiento actual se preserva
