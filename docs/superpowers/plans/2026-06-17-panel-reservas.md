# Panel de Reservas Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un panel en el dashboard para que admin y gerente puedan ver, filtrar, confirmar, editar y eliminar las reservas recibidas.

**Architecture:** Server Component (`app/dashboard/reservas/page.tsx`) carga las reservas SSR y las pasa a un Client Component (`components/reservas/ReservasView.tsx`) que gestiona filtros y acciones vía fetch. API route `app/api/reservas/[id]/route.ts` expone PATCH y DELETE protegidos por rol. Sigue el mismo patrón que `app/dashboard/equipo/page.tsx` + `components/equipo/EquipoClient.tsx`.

**Tech Stack:** Next.js 15 App Router, Supabase (supabaseAdmin para server, createClient para auth), Zod, Tailwind v4, TypeScript

---

## File Map

| Fichero | Acción | Responsabilidad |
|---|---|---|
| `app/dashboard/reservas/page.tsx` | Crear | Auth check, carga SSR de reservas, wrapper AppShell |
| `components/reservas/ReservasView.tsx` | Crear | Tabla, filtros, modal edición, acciones |
| `app/api/reservas/[id]/route.ts` | Crear | PATCH (editar/cambiar estado) + DELETE |

---

## Task 1: API Route — PATCH y DELETE `/api/reservas/[id]`

**Files:**
- Create: `app/api/reservas/[id]/route.ts`

- [ ] **Step 1: Crear el fichero de la API route**

Crea `app/api/reservas/[id]/route.ts` con el siguiente contenido:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonError } from '@/lib/api/errors'

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional(),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida').optional(),
  party_size: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Ningún campo para actualizar' })

async function getCaller(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()
  if (!data) return null
  const rolesData = data.user_roles as unknown as { roles: { name: string } | null }[]
  const rol = rolesData?.[0]?.roles?.name ?? null
  return { restaurantId: data.restaurant_id as string, rol }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const caller = await getCaller(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  // Verificar que la reserva pertenece a este restaurante
  const { data: reserva } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)
    .maybeSingle()

  if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const { data: updated, error } = await supabaseAdmin
    .from('reservations')
    .update(parsed.data)
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)
    .select()
    .single()

  if (error) return jsonError('No se pudo actualizar la reserva', 500, error)
  return NextResponse.json({ data: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const caller = await getCaller(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.rol !== 'admin' && caller.rol !== 'gerente') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: reserva } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)
    .maybeSingle()

  if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('reservations')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', caller.restaurantId)

  if (error) return jsonError('No se pudo eliminar la reserva', 500, error)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar que TypeScript no da errores**

```bash
npx tsc --noEmit
```

Expected: sin errores relacionados con el fichero nuevo.

- [ ] **Step 3: Commit**

```bash
git add app/api/reservas/[id]/route.ts
git commit -m "feat(reservas): api route PATCH y DELETE /api/reservas/[id]"
```

---

## Task 2: Tipo compartido `Reserva`

**Files:**
- Create: `types/reservas.ts`

- [ ] **Step 1: Crear el tipo**

Crea `types/reservas.ts`:

```typescript
export interface Reserva {
  id: string
  restaurant_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  party_size: number
  reservation_date: string   // YYYY-MM-DD
  reservation_time: string   // HH:MM
  status: 'pending' | 'confirmed' | 'cancelled'
  notes: string | null
  consentimiento_rgpd: boolean
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/reservas.ts
git commit -m "feat(reservas): tipo Reserva compartido"
```

---

## Task 3: Server Component — `app/dashboard/reservas/page.tsx`

**Files:**
- Create: `app/dashboard/reservas/page.tsx`

- [ ] **Step 1: Crear la página**

Crea `app/dashboard/reservas/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import AppShell from '@/components/AppShell'
import ReservasView from '@/components/reservas/ReservasView'
import type { Reserva } from '@/types/reservas'
import Link from 'next/link'

export default async function ReservasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: usuarioActual } = await supabase
    .from('users')
    .select('restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!usuarioActual?.restaurant_id) redirect('/login')

  const roles = usuarioActual.user_roles as unknown as { roles: { name: string } | null }[]
  const rolActual = roles?.[0]?.roles?.name ?? null

  if (rolActual !== 'admin' && rolActual !== 'gerente') {
    return (
      <AppShell title="Reservas">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

  const { data: reservasRaw } = await supabaseAdmin
    .from('reservations')
    .select('id, restaurant_id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, notes, consentimiento_rgpd, created_at')
    .eq('restaurant_id', usuarioActual.restaurant_id)
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: true })

  const reservas: Reserva[] = (reservasRaw ?? []) as Reserva[]

  return (
    <AppShell title="Reservas">
      <ReservasView reservas={reservas} />
    </AppShell>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/reservas/page.tsx
git commit -m "feat(reservas): server component página reservas dashboard"
```

---

## Task 4: Client Component — `components/reservas/ReservasView.tsx`

**Files:**
- Create: `components/reservas/ReservasView.tsx`

Este componente tiene tres partes: barra de filtros, tabla de reservas, modal de edición.

- [ ] **Step 1: Crear el componente**

Crea `components/reservas/ReservasView.tsx`:

```typescript
'use client'

import { useState, useMemo } from 'react'
import type { Reserva } from '@/types/reservas'

interface Props {
  reservas: Reserva[]
}

type FiltroEstado = 'all' | 'pending' | 'confirmed' | 'cancelled'

const ESTADO_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

const ESTADO_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReservasView({ reservas: reservasIniciales }: Props) {
  const [reservas, setReservas] = useState<Reserva[]>(reservasIniciales)
  const [filtroFecha, setFiltroFecha] = useState(hoyISO())
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('all')
  const [modalEditar, setModalEditar] = useState<Reserva | null>(null)
  const [cargando, setCargando] = useState<string | null>(null) // id de la reserva en proceso
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Estado del modal de edición
  const [editFecha, setEditFecha] = useState('')
  const [editHora, setEditHora] = useState('')
  const [editPersonas, setEditPersonas] = useState(1)
  const [editNotas, setEditNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  const reservasFiltradas = useMemo(() => {
    return reservas
      .filter(r => r.reservation_date === filtroFecha)
      .filter(r => filtroEstado === 'all' || r.status === filtroEstado)
      .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
  }, [reservas, filtroFecha, filtroEstado])

  function abrirModal(r: Reserva) {
    setModalEditar(r)
    setEditFecha(r.reservation_date)
    setEditHora(r.reservation_time)
    setEditPersonas(r.party_size)
    setEditNotas(r.notes ?? '')
    setErrorModal(null)
  }

  async function cambiarEstado(id: string, status: Reserva['status']) {
    setErrorMsg(null)
    setCargando(id)
    const prevStatus = reservas.find(r => r.id === id)?.status
    // Actualización optimista
    setReservas(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    try {
      const res = await fetch(`/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        // Revertir al estado previo conocido
        setReservas(prev => prev.map(r => r.id === id ? { ...r, status: prevStatus ?? r.status } : r))
        setErrorMsg(data.error ?? 'Error al actualizar')
      }
    } catch {
      setReservas(prev => prev.map(r => r.id === id ? { ...r, status: prevStatus ?? r.status } : r))
      setErrorMsg('Error de conexión')
    } finally {
      setCargando(null)
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la reserva de ${nombre}? Esta acción no se puede deshacer.`)) return
    setErrorMsg(null)
    setCargando(id)
    try {
      const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReservas(prev => prev.filter(r => r.id !== id))
      } else {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Error al eliminar')
      }
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setCargando(null)
    }
  }

  async function guardarEdicion() {
    if (!modalEditar) return
    setErrorModal(null)
    setGuardando(true)
    try {
      const res = await fetch(`/api/reservas/${modalEditar.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_date: editFecha,
          reservation_time: editHora,
          party_size: editPersonas,
          notes: editNotas || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorModal(data.error ?? 'Error al guardar'); return }
      setReservas(prev => prev.map(r => r.id === modalEditar.id ? data.data : r))
      setModalEditar(null)
    } catch {
      setErrorModal('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Error global */}
      {errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs underline">Cerrar</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)] font-medium">Fecha</label>
          <input
            type="date"
            value={filtroFecha}
            onChange={e => setFiltroFecha(e.target.value)}
            className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--text-secondary)] font-medium">Estado</label>
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}
            className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
        <div className="ml-auto text-xs text-[var(--text-secondary)] self-end pb-2">
          {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tabla */}
      {reservasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)] text-sm">
          No hay reservas para los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-surface)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Personas</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Notas</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {reservasFiltradas.map(r => (
                <tr key={r.id} className="bg-white hover:bg-[var(--bg-surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{r.reservation_time.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">
                    <div>{r.customer_name}</div>
                    {r.customer_email && <div className="text-xs text-[var(--text-secondary)]">{r.customer_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.customer_phone}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)] text-center">{r.party_size}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[r.status] ?? ''}`}>
                      {ESTADO_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-[200px] truncate">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {r.status === 'pending' && (
                        <button
                          onClick={() => cambiarEstado(r.id, 'confirmed')}
                          disabled={cargando === r.id}
                          title="Confirmar"
                          className="text-green-600 hover:text-green-800 disabled:opacity-40 font-medium text-xs px-2 py-1 rounded border border-green-200 hover:bg-green-50 transition-colors"
                        >
                          Confirmar
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'confirmed') && (
                        <button
                          onClick={() => cambiarEstado(r.id, 'cancelled')}
                          disabled={cargando === r.id}
                          title="Cancelar"
                          className="text-red-500 hover:text-red-700 disabled:opacity-40 font-medium text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        onClick={() => abrirModal(r)}
                        disabled={cargando === r.id}
                        title="Editar"
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 p-1 rounded hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => eliminar(r.id, r.customer_name)}
                        disabled={cargando === r.id}
                        title="Eliminar"
                        className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal edición */}
      {modalEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={() => setModalEditar(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-[var(--border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Editar reserva</h3>
              <button
                onClick={() => setModalEditar(null)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Datos de solo lectura */}
            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-sm">
              <p className="font-medium text-[var(--text-primary)]">{modalEditar.customer_name}</p>
              <p className="text-[var(--text-secondary)]">{modalEditar.customer_phone}</p>
              {modalEditar.customer_email && <p className="text-[var(--text-secondary)]">{modalEditar.customer_email}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Fecha</label>
                  <input
                    type="date"
                    value={editFecha}
                    onChange={e => setEditFecha(e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Hora</label>
                  <input
                    type="time"
                    value={editHora}
                    onChange={e => setEditHora(e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Número de personas</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={editPersonas}
                  onChange={e => setEditPersonas(Number(e.target.value))}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Notas</label>
                <textarea
                  value={editNotas}
                  onChange={e => setEditNotas(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {errorModal && (
              <p className="text-xs text-red-500 mt-3">{errorModal}</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setModalEditar(null)}
                className="flex-1 px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardando}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/reservas/ReservasView.tsx
git commit -m "feat(reservas): componente cliente ReservasView con tabla, filtros y modal edición"
```

---

## Task 5: Verificación manual en navegador

- [ ] **Step 1: Arrancar el servidor de desarrollo**

```bash
npm run dev
```

- [ ] **Step 2: Verificar la página**

Navega a `http://localhost:3000/dashboard/reservas` con un usuario con rol `admin` o `gerente`.

Comprueba:
- La tabla muestra las reservas del día de hoy (o "No hay reservas" si no hay ninguna para hoy)
- El filtro de fecha cambia las reservas mostradas
- El filtro de estado filtra correctamente
- El botón "Confirmar" cambia el badge a verde inmediatamente (optimista)
- El botón "Cancelar" cambia el badge a rojo
- El lápiz abre el modal con los datos precargados
- Guardar en el modal actualiza la fila sin recargar la página
- El botón 🗑️ pide confirmación y elimina la fila

- [ ] **Step 3: Verificar acceso denegado**

Navega con un usuario con rol `camarero`. Debe ver el mensaje "No tienes permisos".

- [ ] **Step 4: Commit final si todo correcto**

```bash
git add -A
git commit -m "feat(reservas): panel completo de gestión de reservas en dashboard"
```
