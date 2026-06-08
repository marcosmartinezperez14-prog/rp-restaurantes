# Cierre de Caja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo completo de apertura y cierre de turnos de caja con resumen de ventas, cálculo de descuadre y historial paginado.

**Architecture:** Server Component fetches datos iniciales desde Supabase directamente (patrón Finanzas). 4 API routes para mutaciones del Client Component. La tabla `turnos_caja` ya existe en Supabase. Los montos de efectivo se calculan joinando la tabla `payments` para capturar la parte en cash de pagos mixtos.

**Tech Stack:** Next.js App Router, Supabase, TypeScript, Tailwind CSS

---

## Archivos a crear/modificar

| Acción | Archivo |
|---|---|
| CREAR | `types/caja.ts` |
| CREAR | `app/api/caja/turno-activo/route.ts` |
| CREAR | `app/api/caja/abrir/route.ts` |
| CREAR | `app/api/caja/cerrar/route.ts` |
| CREAR | `app/api/caja/historial/route.ts` |
| CREAR | `app/dashboard/caja/page.tsx` |
| CREAR | `components/caja/CajaClient.tsx` |
| MODIFICAR | `components/NavDrawer.tsx` |
| MODIFICAR | `app/dashboard/page.tsx` |

---

## Task 1: Tipos TypeScript

**Files:**
- Create: `types/caja.ts`

- [ ] **Step 1: Crear el archivo de tipos**

Crear `types/caja.ts`:

```typescript
export type EstadoTurno = 'abierto' | 'cerrado'

export interface TurnoCaja {
  id: string
  restaurant_id: string
  abierto_por: string
  cerrado_por: string | null
  fondo_inicial: number
  fecha_apertura: string
  fecha_cierre: string | null
  efectivo_esperado: number | null
  efectivo_contado: number | null
  descuadre: number | null
  total_ventas: number | null
  total_efectivo: number | null
  total_tarjeta: number | null
  total_tickets: number | null
  notas: string | null
  estado: EstadoTurno
  created_at: string
  abierto_por_nombre?: string
  cerrado_por_nombre?: string
}

export interface AbrirTurnoPayload {
  fondo_inicial: number
}

export interface CerrarTurnoPayload {
  efectivo_contado: number
  notas?: string
}

export interface ResumenActual {
  total_ventas: number
  total_efectivo: number
  total_tarjeta: number
  total_tickets: number
}
```

- [ ] **Step 2: Commit**

```bash
git add types/caja.ts
git commit -m "feat: tipos TypeScript para módulo de caja"
```

---

## Task 2: API Route — turno activo

**Files:**
- Create: `app/api/caja/turno-activo/route.ts`

- [ ] **Step 1: Crear la ruta**

Crear `app/api/caja/turno-activo/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: turno } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) return NextResponse.json({ turno: null })

  const { data: u } = await supabase
    .from('users')
    .select('nombre')
    .eq('id', turno.abierto_por)
    .single()

  return NextResponse.json({
    turno: { ...turno, abierto_por_nombre: u?.nombre ?? null },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/caja/turno-activo/route.ts
git commit -m "feat: API GET /api/caja/turno-activo"
```

---

## Task 3: API Route — abrir turno

**Files:**
- Create: `app/api/caja/abrir/route.ts`

- [ ] **Step 1: Crear la ruta**

Crear `app/api/caja/abrir/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: turnoExistente } = await supabase
    .from('turnos_caja')
    .select('id')
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (turnoExistente) {
    return NextResponse.json({ error: 'Ya hay un turno abierto' }, { status: 400 })
  }

  const body = await req.json()
  const fondoInicial = Number(body.fondo_inicial ?? 0)

  const { data: turno, error } = await supabase
    .from('turnos_caja')
    .insert({
      restaurant_id: userData.restaurant_id,
      abierto_por: userData.id,
      fondo_inicial: fondoInicial,
      estado: 'abierto',
    })
    .select('*')
    .single()

  if (error || !turno) return NextResponse.json({ error: error?.message ?? 'Error al abrir turno' }, { status: 500 })

  const { data: u } = await supabase
    .from('users')
    .select('nombre')
    .eq('id', userData.id)
    .single()

  return NextResponse.json(
    { turno: { ...turno, abierto_por_nombre: u?.nombre ?? null } },
    { status: 201 }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/caja/abrir/route.ts
git commit -m "feat: API POST /api/caja/abrir"
```

---

## Task 4: API Route — cerrar turno

**Files:**
- Create: `app/api/caja/cerrar/route.ts`

- [ ] **Step 1: Crear la ruta**

Crear `app/api/caja/cerrar/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: turno } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'abierto')
    .maybeSingle()

  if (!turno) return NextResponse.json({ error: 'No hay turno abierto' }, { status: 400 })

  const body = await req.json()
  const efectivoContado = Number(body.efectivo_contado ?? 0)
  const notas: string | null = body.notas?.trim() || null

  // Calcular totales desde tickets + payments
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, total')
    .eq('restaurant_id', userData.restaurant_id)
    .gte('issued_at', turno.fecha_apertura)

  const ticketIds = (tickets ?? []).map(t => t.id)
  const totalVentas = (tickets ?? []).reduce((sum, t) => sum + Number(t.total), 0)
  const totalTickets = tickets?.length ?? 0

  let totalEfectivo = 0
  let totalTarjeta = 0

  if (ticketIds.length > 0) {
    const { data: pagos } = await supabase
      .from('payments')
      .select('method, amount')
      .in('ticket_id', ticketIds)

    for (const p of pagos ?? []) {
      if (p.method === 'cash') {
        totalEfectivo += Number(p.amount)
      } else {
        totalTarjeta += Number(p.amount)
      }
    }
  }

  const efectivoEsperado = Number(turno.fondo_inicial) + totalEfectivo
  const descuadre = efectivoContado - efectivoEsperado
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('turnos_caja')
    .update({
      estado: 'cerrado',
      fecha_cierre: now,
      cerrado_por: userData.id,
      efectivo_esperado: efectivoEsperado,
      efectivo_contado: efectivoContado,
      descuadre,
      total_ventas: totalVentas,
      total_efectivo: totalEfectivo,
      total_tarjeta: totalTarjeta,
      total_tickets: totalTickets,
      notas,
    })
    .eq('id', turno.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const { data: turnoActualizado } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('id', turno.id)
    .single()

  const [{ data: u1 }, { data: u2 }] = await Promise.all([
    supabase.from('users').select('nombre').eq('id', turnoActualizado!.abierto_por).single(),
    supabase.from('users').select('nombre').eq('id', turnoActualizado!.cerrado_por).single(),
  ])

  return NextResponse.json({
    turno: {
      ...turnoActualizado,
      abierto_por_nombre: u1?.nombre ?? null,
      cerrado_por_nombre: u2?.nombre ?? null,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/caja/cerrar/route.ts
git commit -m "feat: API POST /api/caja/cerrar con cálculo de totales via payments"
```

---

## Task 5: API Route — historial

**Files:**
- Create: `app/api/caja/historial/route.ts`

- [ ] **Step 1: Crear la ruta**

Crear `app/api/caja/historial/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('restaurant_id')
    .eq('auth_id', user.id)
    .single()
  if (!userData?.restaurant_id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pagina = Math.max(1, Number(searchParams.get('pagina') ?? 1))
  const limite = Math.min(50, Math.max(1, Number(searchParams.get('limite') ?? 20)))
  const offset = (pagina - 1) * limite

  const { data, count, error } = await supabase
    .from('turnos_caja')
    .select('*', { count: 'exact' })
    .eq('restaurant_id', userData.restaurant_id)
    .eq('estado', 'cerrado')
    .order('fecha_apertura', { ascending: false })
    .range(offset, offset + limite - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Batch user lookup
  const userIds = [...new Set([
    ...(data ?? []).map(t => t.abierto_por as string),
    ...(data ?? []).filter(t => t.cerrado_por).map(t => t.cerrado_por as string),
  ])]

  const userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, nombre')
      .in('id', userIds)
    for (const u of users ?? []) {
      userMap[u.id] = u.nombre
    }
  }

  const turnos = (data ?? []).map(t => ({
    ...t,
    abierto_por_nombre: userMap[t.abierto_por] ?? null,
    cerrado_por_nombre: t.cerrado_por ? (userMap[t.cerrado_por] ?? null) : null,
  }))

  return NextResponse.json({ data: turnos, total: count ?? 0, pagina, limite })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/caja/historial/route.ts
git commit -m "feat: API GET /api/caja/historial paginado"
```

---

## Task 6: Server Component

**Files:**
- Create: `app/dashboard/caja/page.tsx`

- [ ] **Step 1: Crear la página**

Crear `app/dashboard/caja/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import CajaClient from '@/components/caja/CajaClient'
import { PERMISOS_POR_ROL, type RolNombre } from '@/types/equipo'
import type { TurnoCaja, ResumenActual } from '@/types/caja'

export default async function CajaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('id, restaurant_id, user_roles!user_id(roles(name))')
    .eq('auth_id', user.id)
    .single()

  if (!userData?.restaurant_id) redirect('/login')
  const restaurantId = userData.restaurant_id

  const roles = userData.user_roles as { roles: { name: string } | null }[] | undefined
  const rol = (roles?.[0]?.roles?.name ?? null) as RolNombre | null
  const tieneAcceso = rol ? PERMISOS_POR_ROL[rol].modulos.includes('administracion') : false

  if (!tieneAcceso) {
    return (
      <AppShell title="Caja">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--text-secondary)] text-center">No tienes permisos para acceder a esta sección.</p>
          <Link href="/dashboard" className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
            Volver al inicio
          </Link>
        </div>
      </AppShell>
    )
  }

  // Turno activo
  const { data: turnoRaw } = await supabase
    .from('turnos_caja')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('estado', 'abierto')
    .maybeSingle()

  let turnoActivo: TurnoCaja | null = null
  let resumenActual: ResumenActual | null = null

  if (turnoRaw) {
    const { data: u } = await supabase
      .from('users').select('nombre').eq('id', turnoRaw.abierto_por).single()
    turnoActivo = { ...turnoRaw, abierto_por_nombre: u?.nombre ?? undefined }

    // Calcular resumen en tiempo real
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, total')
      .eq('restaurant_id', restaurantId)
      .gte('issued_at', turnoRaw.fecha_apertura)

    const ticketIds = (tickets ?? []).map(t => t.id)
    let ef = 0, tar = 0

    if (ticketIds.length > 0) {
      const { data: pagos } = await supabase
        .from('payments').select('method, amount').in('ticket_id', ticketIds)
      for (const p of pagos ?? []) {
        if (p.method === 'cash') ef += Number(p.amount)
        else tar += Number(p.amount)
      }
    }

    resumenActual = {
      total_ventas: (tickets ?? []).reduce((s, t) => s + Number(t.total), 0),
      total_tickets: tickets?.length ?? 0,
      total_efectivo: ef,
      total_tarjeta: tar,
    }
  }

  // Historial (primeras 20 filas)
  const { data: historialRaw, count } = await supabase
    .from('turnos_caja')
    .select('*', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('estado', 'cerrado')
    .order('fecha_apertura', { ascending: false })
    .range(0, 19)

  const userIds = [...new Set([
    ...(historialRaw ?? []).map(t => t.abierto_por as string),
    ...(historialRaw ?? []).filter(t => t.cerrado_por).map(t => t.cerrado_por as string),
  ])]

  const userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users').select('id, nombre').in('id', userIds)
    for (const u of users ?? []) userMap[u.id] = u.nombre
  }

  const historial: TurnoCaja[] = (historialRaw ?? []).map(t => ({
    ...t,
    abierto_por_nombre: userMap[t.abierto_por] ?? undefined,
    cerrado_por_nombre: t.cerrado_por ? (userMap[t.cerrado_por] ?? undefined) : undefined,
  }))

  return (
    <AppShell title="Caja">
      <CajaClient
        turnoActivo={turnoActivo}
        historial={historial}
        totalHistorial={count ?? 0}
        resumenActual={resumenActual}
      />
    </AppShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/caja/page.tsx
git commit -m "feat: página servidor /dashboard/caja"
```

---

## Task 7: Client Component

**Files:**
- Create: `components/caja/CajaClient.tsx`

- [ ] **Step 1: Crear el componente**

Crear `components/caja/CajaClient.tsx`:

```typescript
'use client'

import { useState, Fragment } from 'react'
import type { TurnoCaja, CerrarTurnoPayload, ResumenActual } from '@/types/caja'

interface Props {
  turnoActivo: TurnoCaja | null
  historial: TurnoCaja[]
  totalHistorial: number
  resumenActual: ResumenActual | null
}

function fmt(v: number) {
  return v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DescuadreChip({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-gray-400">—</span>
  const color = valor === 0 ? 'text-gray-500' : valor > 0 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-medium ${color}`}>{valor >= 0 ? '+' : ''}{fmt(valor)}</span>
}

const LIMITE = 20

export default function CajaClient({
  turnoActivo: initialTurno,
  historial: initialHistorial,
  totalHistorial: initialTotal,
  resumenActual,
}: Props) {
  const [turno, setTurno] = useState<TurnoCaja | null>(initialTurno)
  const [historial, setHistorial] = useState<TurnoCaja[]>(initialHistorial)
  const [totalH, setTotalH] = useState(initialTotal)
  const [vista, setVista] = useState<'actual' | 'historial'>('actual')
  const [fondoInicial, setFondoInicial] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalCierre, setModalCierre] = useState(false)
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [pagina, setPagina] = useState(1)
  const [filaExpandida, setFilaExpandida] = useState<string | null>(null)

  const efectivoEsperado = turno
    ? Number(turno.fondo_inicial) + (resumenActual?.total_efectivo ?? 0)
    : 0
  const efectivoContadoNum = parseFloat(efectivoContado) || 0
  const diferencia = efectivoContadoNum - efectivoEsperado
  const totalPaginas = Math.ceil(totalH / LIMITE)

  async function handleAbrirTurno() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/caja/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fondo_inicial: parseFloat(fondoInicial) || 0 }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al abrir turno'); return }
      setTurno(data.turno)
      setFondoInicial('0')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleCerrarTurno() {
    setError(null)
    setLoading(true)
    try {
      const payload: CerrarTurnoPayload = {
        efectivo_contado: parseFloat(efectivoContado) || 0,
        notas: notasCierre || undefined,
      }
      const res = await fetch('/api/caja/cerrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al cerrar turno'); return }
      setHistorial(prev => [data.turno, ...prev])
      setTotalH(prev => prev + 1)
      setTurno(null)
      setModalCierre(false)
      setEfectivoContado('')
      setNotasCierre('')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function cargarHistorial(p: number) {
    try {
      const res = await fetch(`/api/caja/historial?pagina=${p}&limite=${LIMITE}`)
      if (!res.ok) return
      const data = await res.json()
      setHistorial(data.data)
      setTotalH(data.total)
      setPagina(p)
    } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {(['actual', 'historial'] as const).map(v => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              vista === v ? 'bg-blue-600 text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {v === 'actual' ? 'Turno actual' : 'Historial'}
          </button>
        ))}
      </div>

      {/* ── Turno actual ── */}
      {vista === 'actual' && (
        <>
          {!turno ? (
            <div className="max-w-md mx-auto">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-6">
                <div className="text-6xl">🏧</div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Sin turno activo</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">Abre un turno para empezar a registrar ventas</p>
                </div>
                <div className="text-left">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Fondo inicial de caja (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={fondoInicial}
                    onChange={e => setFondoInicial(e.target.value)}
                    className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
                <button
                  onClick={handleAbrirTurno}
                  disabled={loading}
                  className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Abriendo...' : 'Abrir turno'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    Turno abierto
                  </span>
                  <p className="text-sm text-[var(--text-secondary)] pt-1">
                    Desde {fmtFecha(turno.fecha_apertura)}
                    {turno.abierto_por_nombre ? ` · ${turno.abierto_por_nombre}` : ''}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Fondo inicial:{' '}
                    <span className="font-medium text-[var(--text-primary)]">{fmt(Number(turno.fondo_inicial))}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setModalCierre(true); setError(null) }}
                  className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors"
                >
                  Cerrar turno
                </button>
              </div>

              {resumenActual && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total vendido',  valor: fmt(resumenActual.total_ventas) },
                    { label: 'En efectivo',    valor: fmt(resumenActual.total_efectivo) },
                    { label: 'En tarjeta',     valor: fmt(resumenActual.total_tarjeta) },
                    { label: 'Tickets',        valor: String(resumenActual.total_tickets) },
                  ].map(({ label, valor }) => (
                    <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4">
                      <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{valor}</p>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            </div>
          )}
        </>
      )}

      {/* ── Historial ── */}
      {vista === 'historial' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {historial.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Sin cierres registrados aún.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface-hover)]">
                  <tr>
                    {['Apertura', 'Cierre', 'Abierto por', 'Ventas', 'Efectivo', 'Tarjeta', 'Tickets', 'Descuadre', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {historial.map(t => (
                    <Fragment key={t.id}>
                      <tr className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{fmtFecha(t.fecha_apertura)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{t.fecha_cierre ? fmtFecha(t.fecha_cierre) : '—'}</td>
                        <td className="px-4 py-3 text-xs">{t.abierto_por_nombre ?? '—'}</td>
                        <td className="px-4 py-3 font-medium">{fmt(Number(t.total_ventas ?? 0))}</td>
                        <td className="px-4 py-3">{fmt(Number(t.total_efectivo ?? 0))}</td>
                        <td className="px-4 py-3">{fmt(Number(t.total_tarjeta ?? 0))}</td>
                        <td className="px-4 py-3 text-center">{t.total_tickets ?? 0}</td>
                        <td className="px-4 py-3"><DescuadreChip valor={t.descuadre !== null ? Number(t.descuadre) : null} /></td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setFilaExpandida(prev => prev === t.id ? null : t.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                          >
                            {filaExpandida === t.id ? 'Ocultar' : 'Ver detalle'}
                          </button>
                        </td>
                      </tr>
                      {filaExpandida === t.id && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-slate-50">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Cerrado por</p>
                                <p className="font-medium">{t.cerrado_por_nombre ?? '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Fondo inicial</p>
                                <p className="font-medium">{fmt(Number(t.fondo_inicial))}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Efectivo esperado</p>
                                <p className="font-medium">{fmt(Number(t.efectivo_esperado ?? 0))}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Efectivo contado</p>
                                <p className="font-medium">{fmt(Number(t.efectivo_contado ?? 0))}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-0.5">Descuadre</p>
                                <DescuadreChip valor={t.descuadre !== null ? Number(t.descuadre) : null} />
                              </div>
                              {t.notas && (
                                <div className="col-span-2 sm:col-span-3">
                                  <p className="text-xs text-gray-500 mb-0.5">Notas</p>
                                  <p>{t.notas}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => cargarHistorial(pagina - 1)}
                disabled={pagina <= 1}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg disabled:opacity-40 hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-[var(--text-secondary)]">Página {pagina} de {totalPaginas}</span>
              <button
                onClick={() => cargarHistorial(pagina + 1)}
                disabled={pagina >= totalPaginas}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--border)] rounded-lg disabled:opacity-40 hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal de cierre ── */}
      {modalCierre && turno && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Cierre de turno</h2>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total ventas</span>
                <span className="font-medium text-gray-900">{fmt(resumenActual?.total_ventas ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Efectivo esperado en caja</span>
                <span className="font-medium text-gray-900">{fmt(efectivoEsperado)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Efectivo contado en caja (€)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={efectivoContado}
                onChange={e => setEfectivoContado(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {efectivoContado !== '' && (
                <p className={`text-sm mt-2 font-medium ${
                  diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  Diferencia: {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                value={notasCierre}
                onChange={e => setNotasCierre(e.target.value)}
                rows={2}
                placeholder="Observaciones del cierre..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setModalCierre(false); setError(null) }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCerrarTurno}
                disabled={loading || efectivoContado === ''}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/caja/CajaClient.tsx
git commit -m "feat: CajaClient con apertura, cierre modal e historial paginado"
```

---

## Task 8: Navegación

**Files:**
- Modify: `components/NavDrawer.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Añadir Caja a NavDrawer**

En `components/NavDrawer.tsx`, añadir al array `NAV_ITEMS` (después de la entrada de Personal):

```typescript
{ href: '/dashboard/caja', label: 'Caja', icon: '🏦' },
```

El array completo queda:

```typescript
const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Inicio',    icon: '🏠' },
  { href: '/tpv',                label: 'TPV',        icon: '🖥️' },
  { href: '/reservas',           label: 'Reservas',   icon: '📅' },
  { href: '/productos',          label: 'Productos',  icon: '📦' },
  { href: '/dashboard/personal', label: 'Personal',   icon: '🗓️' },
  { href: '/dashboard/caja',     label: 'Caja',       icon: '🏦' },
]
```

- [ ] **Step 2: Añadir tarjeta Caja al dashboard**

En `app/dashboard/page.tsx`, añadir al array `NAV_CARDS` (después de la tarjeta de Configuración y antes de Administración):

```typescript
{
  href: '/dashboard/caja',
  icon: '🏦',
  label: 'Caja',
  description: 'Turnos, apertura y cierre de caja',
  color: 'bg-[var(--bg-surface)] border-green-500/40 hover:bg-[var(--bg-surface-hover)]',
  iconBg: 'bg-green-500/15',
  labelColor: 'text-green-600',
  modulo: 'administracion',
},
```

- [ ] **Step 3: Commit**

```bash
git add components/NavDrawer.tsx app/dashboard/page.tsx
git commit -m "feat: entrada Caja en NavDrawer y tarjeta en dashboard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tabla `turnos_caja` (ya existente)
- ✅ Tipos `TurnoCaja`, `AbrirTurnoPayload`, `CerrarTurnoPayload`, `ResumenActual`
- ✅ `GET /api/caja/turno-activo`
- ✅ `POST /api/caja/abrir` con validación de turno existente
- ✅ `POST /api/caja/cerrar` — JOIN a `payments` para efectivo exacto (incluyendo pagos mixtos)
- ✅ `GET /api/caja/historial` paginado con batch lookup de usuarios
- ✅ Server Component con control de acceso por rol (`administracion`)
- ✅ Resumen en tiempo real calculado en el Server Component
- ✅ Panel apertura sin turno
- ✅ Panel turno en curso con 4 métricas
- ✅ Modal de cierre con efectivo esperado y diferencia dinámica
- ✅ Vista historial con fila expandible y paginación
- ✅ NavDrawer + tarjeta dashboard
- ✅ Sin `<form>`, sin lucide-react, textos en español
- ✅ `users.nombre` (no `full_name`)
- ✅ `restaurant_id` obtenido via `users.auth_id` (no `get_current_restaurant_id()` en queries)
