# Franjas Horarias Múltiples por Día — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar el modelo de horarios de reserva de un único rango apertura/cierre por día a una lista de franjas, permitiendo múltiples intervalos (ej. comidas + cenas).

**Architecture:** Se actualiza el tipo `DiaSchedule` en `types/administracion.ts` para usar `franjas: Franja[]`. La validación del server action y la API pública se adaptan al nuevo array. El componente `ReservasConfigPanel` añade botones para añadir/quitar franjas por día.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Supabase

---

## Archivos a modificar

| Acción | Ruta |
|---|---|
| MODIFICAR | `types/administracion.ts` |
| MODIFICAR | `app/actions/administracion.ts` |
| MODIFICAR | `components/administracion/ReservasConfigPanel.tsx` |
| MODIFICAR | `app/api/cliente/[slug]/reservas/route.ts` |

---

## Task 1: Tipos y defaults

**Files:**
- Modify: `types/administracion.ts`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
export type Franja = {
  apertura: string
  cierre: string
}

export type DiaSchedule = {
  activo: boolean
  franjas: Franja[]
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

const DEFAULT_FRANJA: Franja = { apertura: '13:00', cierre: '23:30' }

export const DEFAULT_CONFIG: ReservasConfig = {
  auto_confirm: true,
  duration_minutes: 90,
  schedule: {
    lunes:     { activo: true,  franjas: [DEFAULT_FRANJA] },
    martes:    { activo: true,  franjas: [DEFAULT_FRANJA] },
    miercoles: { activo: true,  franjas: [DEFAULT_FRANJA] },
    jueves:    { activo: true,  franjas: [DEFAULT_FRANJA] },
    viernes:   { activo: true,  franjas: [DEFAULT_FRANJA] },
    sabado:    { activo: true,  franjas: [DEFAULT_FRANJA] },
    domingo:   { activo: false, franjas: [DEFAULT_FRANJA] },
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add types/administracion.ts
git commit -m "feat: tipo Franja y DiaSchedule con franjas[] en lugar de apertura/cierre"
```

---

## Task 2: Validación en el server action

**Files:**
- Modify: `app/actions/administracion.ts`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Schedule, ReservasConfig } from '@/types/administracion'
import { DEFAULT_CONFIG } from '@/types/administracion'

export type { Franja, DiaSchedule, Schedule, ReservasConfig } from '@/types/administracion'

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
      if (d.franjas.length === 0) {
        return { error: `Añade al menos una franja para ${dia}` }
      }
      for (const franja of d.franjas) {
        if (!isValidTime(franja.apertura) || !isValidTime(franja.cierre)) {
          return { error: `Horario inválido para ${dia}` }
        }
        if (franja.apertura >= franja.cierre) {
          return { error: `La hora de cierre debe ser posterior a la apertura (${dia})` }
        }
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
git commit -m "feat: validación de franjas[] en guardarReservasConfig"
```

---

## Task 3: UI del panel de configuración

**Files:**
- Modify: `components/administracion/ReservasConfigPanel.tsx`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
'use client'

import { useState, useTransition } from 'react'
import type { ReservasConfig, Schedule, DiaSchedule, Franja } from '@/types/administracion'
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
    setConfig(prev => {
      const current = prev.schedule[key]
      const updated = { ...current, ...partial }
      if (updated.activo && updated.franjas.length === 0) {
        updated.franjas = [{ apertura: '', cierre: '' }]
      }
      return { ...prev, schedule: { ...prev.schedule, [key]: updated } }
    })
  }

  function setFranja(key: keyof Schedule, index: number, partial: Partial<Franja>) {
    setConfig(prev => {
      const franjas = prev.schedule[key].franjas.map((f, i) =>
        i === index ? { ...f, ...partial } : f
      )
      return { ...prev, schedule: { ...prev.schedule, [key]: { ...prev.schedule[key], franjas } } }
    })
  }

  function addFranja(key: keyof Schedule) {
    setConfig(prev => {
      const franjas = [...prev.schedule[key].franjas, { apertura: '', cierre: '' }]
      return { ...prev, schedule: { ...prev.schedule, [key]: { ...prev.schedule[key], franjas } } }
    })
  }

  function removeFranja(key: keyof Schedule, index: number) {
    setConfig(prev => {
      const franjas = prev.schedule[key].franjas.filter((_, i) => i !== index)
      return { ...prev, schedule: { ...prev.schedule, [key]: { ...prev.schedule[key], franjas } } }
    })
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
        <div className="space-y-4">
          {DIAS.map(({ key, label }) => {
            const dia = config.schedule[key]
            return (
              <div key={key} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 mb-2">
                  {/* Toggle activo */}
                  <button
                    onClick={() => setDia(key, { activo: !dia.activo })}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${dia.activo ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dia.activo ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className={`text-sm font-medium w-24 ${dia.activo ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {label}
                  </span>
                  {!dia.activo && (
                    <span className="text-xs text-[var(--text-secondary)]">Cerrado</span>
                  )}
                </div>

                {dia.activo && (
                  <div className="ml-[52px] space-y-2">
                    {dia.franjas.map((franja, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={franja.apertura}
                          onChange={e => setFranja(key, i, { apertura: e.target.value })}
                          className="border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-[var(--text-secondary)]">hasta</span>
                        <input
                          type="time"
                          value={franja.cierre}
                          onChange={e => setFranja(key, i, { cierre: e.target.value })}
                          className="border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {dia.franjas.length > 1 && (
                          <button
                            onClick={() => removeFranja(key, i)}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors text-sm font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addFranja(key)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
                    >
                      + Añadir franja
                    </button>
                  </div>
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
git commit -m "feat: UI de franjas horarias múltiples en ReservasConfigPanel"
```

---

## Task 4: Validación en la API pública

**Files:**
- Modify: `app/api/cliente/[slug]/reservas/route.ts`

- [ ] **Step 1: Reemplazar el bloque de validación de horario**

En `app/api/cliente/[slug]/reservas/route.ts`, reemplazar el bloque que actualmente valida `diaConfig.activo` y `hora < diaConfig.apertura || hora >= diaConfig.cierre` por:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Schedule } from '@/types/administracion'

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

    const { data: settings } = await supabaseAdmin
      .from('reservation_settings')
      .select('auto_confirm, schedule')
      .eq('restaurant_id', restaurante.id)
      .maybeSingle()

    let autoConfirm = true

    if (settings) {
      const schedule = settings.schedule as Schedule
      autoConfirm = settings.auto_confirm

      const [anio, mes, dia] = fecha.split('-').map(Number)
      const diaSemana = new Date(anio, mes - 1, dia).getDay()
      const diaKey = DIA_MAP[diaSemana]
      const diaConfig = schedule[diaKey]

      if (!diaConfig.activo) {
        return NextResponse.json({ error: 'El restaurante no acepta reservas ese día' }, { status: 400 })
      }

      const horaValida = diaConfig.franjas.some(f => hora >= f.apertura && hora < f.cierre)
      if (!horaValida) {
        return NextResponse.json({ error: 'Fuera del horario de reservas' }, { status: 400 })
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
git add "app/api/cliente/[slug]/reservas/route.ts"
git commit -m "feat: validar hora contra franjas[] en API pública de reservas"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tipo `Franja` añadido
- ✅ `DiaSchedule` usa `franjas: Franja[]` en lugar de `apertura/cierre`
- ✅ `DEFAULT_CONFIG` actualizado con el nuevo formato
- ✅ Validación server: día activo necesita ≥ 1 franja, cada franja apertura < cierre
- ✅ UI: lista de franjas por día, botón × (solo si hay más de 1), "+ Añadir franja"
- ✅ Toggle OFF conserva franjas; toggle ON con franjas vacías añade franja vacía
- ✅ API pública: acepta si hora cae en cualquiera de las franjas
- ✅ Sin validación de solapamiento (según spec)
