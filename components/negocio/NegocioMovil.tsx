'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ResumenHoy, ActividadReciente } from '@/types/negocio'

function fmt(valor: number) {
  return valor.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

function tiempoDesde(fecha: Date): string {
  const mins = Math.floor((Date.now() - fecha.getTime()) / 60_000)
  if (mins < 1) return 'ahora mismo'
  if (mins === 1) return 'hace 1 min'
  return `hace ${mins} min`
}

function horaDeISO(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fechaHoy(): string {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())
}

function diferenciaVsAyer(
  hoy: number,
  ayer: number,
): { texto: string; color: string } {
  if (ayer === 0) return { texto: '— sin datos de ayer', color: 'text-[var(--text-secondary)]' }
  const pct = ((hoy - ayer) / ayer) * 100
  if (Math.abs(pct) < 0.5) return { texto: '= igual que ayer', color: 'text-[var(--text-secondary)]' }
  if (pct > 0) return { texto: `▲ +${pct.toFixed(1)}% vs ayer`, color: 'text-green-600' }
  return { texto: `▼ ${pct.toFixed(1)}% vs ayer`, color: 'text-red-500' }
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export default function NegocioMovil() {
  const [resumen, setResumen]           = useState<ResumenHoy | null>(null)
  const [actividad, setActividad]       = useState<ActividadReciente[]>([])
  const [loadingResumen, setLoadingR]   = useState(true)
  const [loadingActividad, setLoadingA] = useState(true)
  const [errorResumen, setErrorR]       = useState<string | null>(null)
  const [errorActividad, setErrorA]     = useState<string | null>(null)
  const [ultimaAct, setUltimaAct]       = useState<Date | null>(null)
  const [tiempoLabel, setTiempoLabel]   = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarResumen = useCallback(async () => {
    setLoadingR(true)
    setErrorR(null)
    try {
      const res = await fetch('/api/negocio?tipo=resumen')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResumen(json.data?.[0] ?? null)
    } catch (e) {
      setErrorR(String(e))
    } finally {
      setLoadingR(false)
    }
  }, [])

  const cargarActividad = useCallback(async () => {
    setLoadingA(true)
    setErrorA(null)
    try {
      const res = await fetch('/api/negocio?tipo=actividad')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setActividad(json.data ?? [])
    } catch (e) {
      setErrorA(String(e))
    } finally {
      setLoadingA(false)
    }
  }, [])

  const cargarTodo = useCallback(async () => {
    await Promise.all([cargarResumen(), cargarActividad()])
    const ahora = new Date()
    setUltimaAct(ahora)
    setTiempoLabel(tiempoDesde(ahora))
  }, [cargarResumen, cargarActividad])

  const recargar = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    await cargarTodo()
    intervalRef.current = setInterval(cargarTodo, 60_000)
  }, [cargarTodo])

  useEffect(() => {
    if (!ultimaAct) return
    const t = setInterval(() => setTiempoLabel(tiempoDesde(ultimaAct)), 30_000)
    return () => clearInterval(t)
  }, [ultimaAct])

  useEffect(() => {
    cargarTodo()
    intervalRef.current = setInterval(cargarTodo, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const diff = resumen
    ? diferenciaVsAyer(Number(resumen.ingresos_hoy), Number(resumen.ingresos_ayer))
    : null

  return (
    <div className="max-w-[430px] mx-auto min-h-screen bg-[var(--bg-page)] px-4 py-6 flex flex-col gap-5">

      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mi negocio</h1>
          <p className="text-sm text-[var(--text-secondary)] capitalize">{fechaHoy()}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={recargar}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-lg"
            aria-label="Recargar datos"
          >
            🔄
          </button>
          {tiempoLabel && (
            <span className="text-[10px] text-[var(--text-secondary)]">Actualizado {tiempoLabel}</span>
          )}
        </div>
      </div>

      {/* KPI principal + secundarios */}
      {errorResumen ? (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-red-200 p-5 shadow-sm">
          <p className="text-sm text-red-500 mb-3">No se pudieron cargar los KPIs.</p>
          <button
            onClick={cargarResumen}
            className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Ingresos del día */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              Ingresos de hoy
            </p>
            {loadingResumen ? (
              <>
                <Skeleton className="h-10 w-36 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <p className="text-4xl font-bold text-[var(--text-primary)]">
                  {fmt(Number(resumen?.ingresos_hoy ?? 0))}
                </p>
                {diff && (
                  <p className={`text-sm font-medium mt-1 ${diff.color}`}>{diff.texto}</p>
                )}
              </>
            )}
          </div>

          {/* Grid 2x2 KPIs secundarios */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <p className="text-[11px] text-[var(--text-secondary)] mb-1">📋 Pedidos cerrados</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {resumen?.pedidos_cerrados ?? 0}
                </p>
              )}
            </div>

            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <p className="text-[11px] text-[var(--text-secondary)] mb-1">🧾 Ticket medio</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {fmt(Number(resumen?.ticket_medio ?? 0))}
                </p>
              )}
            </div>

            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <p className="text-[11px] text-[var(--text-secondary)] mb-1">🪑 Mesas ocupadas</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {resumen?.mesas_ocupadas ?? 0}
                  <span className="text-base font-normal text-[var(--text-secondary)]">
                    {' '}/ {resumen?.mesas_totales ?? 0}
                  </span>
                </p>
              )}
            </div>

            <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 shadow-sm">
              <p className="text-[11px] text-[var(--text-secondary)] mb-1">⭐ Producto estrella</p>
              {loadingResumen ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className="text-sm font-bold text-[var(--text-primary)] leading-tight mt-1 truncate">
                  {resumen?.producto_estrella ?? '—'}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Actividad reciente */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-800 mb-3">Últimos pedidos de hoy</p>
        {errorActividad ? (
          <p className="text-sm text-[var(--text-secondary)]">No se pudo cargar la actividad reciente.</p>
        ) : loadingActividad ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : actividad.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aún no hay pedidos cerrados hoy.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100">
            {actividad.map((a) => (
              <li key={a.pedido_id} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                  {a.mesa_nombre}
                </span>
                <span className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {horaDeISO(a.cerrado_at)}
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex-shrink-0">
                  {fmt(Number(a.total))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
