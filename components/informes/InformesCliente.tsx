'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type {
  VentasFranja, VentasCamarero, ProductoRanking, ResumenVentas, RangoFecha,
} from '@/types/informes'

function calcularRango(
  rango: RangoFecha,
  desdeCustom: string,
  hastaCustom: string,
): [string, string] {
  const hasta = new Date()
  hasta.setHours(23, 59, 59, 999)
  if (rango === 'custom') {
    const d = new Date(desdeCustom + 'T00:00:00')
    const h = new Date(hastaCustom + 'T23:59:59')
    return [d.toISOString(), h.toISOString()]
  }
  const desde = new Date()
  const dias = rango === '7d' ? 7 : rango === '30d' ? 30 : 90
  desde.setDate(desde.getDate() - dias)
  desde.setHours(0, 0, 0, 0)
  return [desde.toISOString(), hasta.toISOString()]
}

function fmt(valor: number) {
  return `${Number(valor).toFixed(2)} €`
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

const RANGOS: { id: RangoFecha; label: string }[] = [
  { id: '7d',     label: 'Últimos 7 días' },
  { id: '30d',    label: 'Últimos 30 días' },
  { id: '90d',    label: 'Últimos 90 días' },
  { id: 'custom', label: 'Personalizado' },
]

const KPI_CONFIG: { key: keyof ResumenVentas; label: string; moneda: boolean }[] = [
  { key: 'total_ingresos',     label: 'Total ingresos',      moneda: true },
  { key: 'num_pedidos',        label: 'Nº pedidos',          moneda: false },
  { key: 'ticket_medio',       label: 'Ticket medio',        moneda: true },
  { key: 'productos_distintos', label: 'Productos distintos', moneda: false },
]

export default function InformesCliente() {
  const [rango, setRango]         = useState<RangoFecha>('30d')
  const [desde, setDesde]         = useState('')
  const [hasta, setHasta]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [resumen, setResumen]     = useState<ResumenVentas | null>(null)
  const [franjas, setFranjas]     = useState<VentasFranja[]>([])
  const [camareros, setCamareros] = useState<VentasCamarero[]>([])
  const [productos, setProductos] = useState<ProductoRanking[]>([])
  const [errores, setErrores]     = useState<Record<string, string>>({})

  const cargarDatos = useCallback(async () => {
    if (rango === 'custom' && (!desde || !hasta)) return
    setLoading(true)
    setErrores({})

    const [d, h] = calcularRango(rango, desde, hasta)
    const base = `/api/informes?desde=${encodeURIComponent(d)}&hasta=${encodeURIComponent(h)}`

    const [resumenRes, franjasRes, camarerosRes, productosRes] = await Promise.allSettled([
      fetch(`${base}&tipo=resumen`).then(r => r.json()),
      fetch(`${base}&tipo=franja`).then(r => r.json()),
      fetch(`${base}&tipo=camarero`).then(r => r.json()),
      fetch(`${base}&tipo=productos`).then(r => r.json()),
    ])

    const e: Record<string, string> = {}

    if (resumenRes.status === 'fulfilled' && !resumenRes.value.error) {
      setResumen(resumenRes.value.data?.[0] ?? null)
    } else {
      e.resumen = resumenRes.status === 'rejected'
        ? String(resumenRes.reason)
        : resumenRes.value.error
    }

    if (franjasRes.status === 'fulfilled' && !franjasRes.value.error) {
      setFranjas(franjasRes.value.data ?? [])
    } else {
      e.franjas = franjasRes.status === 'rejected'
        ? String(franjasRes.reason)
        : franjasRes.value.error
    }

    if (camarerosRes.status === 'fulfilled' && !camarerosRes.value.error) {
      setCamareros(camarerosRes.value.data ?? [])
    } else {
      e.camareros = camarerosRes.status === 'rejected'
        ? String(camarerosRes.reason)
        : camarerosRes.value.error
    }

    if (productosRes.status === 'fulfilled' && !productosRes.value.error) {
      setProductos(productosRes.value.data ?? [])
    } else {
      e.productos = productosRes.status === 'rejected'
        ? String(productosRes.reason)
        : productosRes.value.error
    }

    setErrores(e)
    setLoading(false)
  }, [rango, desde, hasta])

  useEffect(() => { cargarDatos() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const top10    = productos.slice(0, 10)
  const bottom10 = [...productos].reverse().slice(0, 10)

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {RANGOS.map(r => (
          <button
            key={r.id}
            onClick={() => setRango(r.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              rango === r.id
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {r.label}
          </button>
        ))}
        {rango === 'custom' && (
          <>
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black"
            />
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-black"
            />
          </>
        )}
        <button
          onClick={cargarDatos}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
        >
          Actualizar
        </button>
      </div>

      {/* ── KPIs ── */}
      {errores.resumen ? (
        <p className="text-sm text-red-500">Error al cargar KPIs: {errores.resumen}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_CONFIG.map(({ key, label, moneda }) => (
            <div
              key={key}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4"
            >
              <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <div className="text-xl font-bold text-[var(--text-primary)]">
                  {moneda
                    ? fmt(Number(resumen?.[key] ?? 0))
                    : String(resumen?.[key] ?? 0)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Gráfico franjas ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Ventas por franja horaria
        </div>
        {errores.franjas ? (
          <p className="text-sm text-red-500">Error: {errores.franjas}</p>
        ) : loading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={franjas} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="franja" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v ?? 0}€`} />
              <Tooltip
                formatter={(value: any) => [`${Number(value ?? 0).toFixed(2)} €`, 'Ventas']}
              />
              <Bar dataKey="total_ventas" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Tabla camareros ── */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Ventas por camarero
        </div>
        {errores.camareros ? (
          <p className="text-sm text-red-500">Error: {errores.camareros}</p>
        ) : loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : camareros.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Datos de camarero no disponibles en este período.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)]">Camarero</th>
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)] text-right">Pedidos</th>
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)] text-right">Ingresos</th>
                <th className="pb-2 text-xs font-medium text-[var(--text-secondary)] text-right">Ticket medio</th>
              </tr>
            </thead>
            <tbody>
              {camareros.map((c, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 text-[var(--text-primary)]">{c.camarero_nombre}</td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">{c.num_pedidos}</td>
                  <td className="py-2 text-right font-medium text-[var(--text-primary)]">
                    {fmt(Number(c.total_ventas))}
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">
                    {fmt(Number(c.ticket_medio))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Ranking de productos ── */}
      {errores.productos ? (
        <p className="text-sm text-red-500">Error al cargar productos: {errores.productos}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Top 10 */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Top 10 más vendidos
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : top10.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin datos en este período.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {top10.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-[var(--text-secondary)] w-5 flex-shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <span className="flex-1 text-[var(--text-primary)] truncate">
                      {p.producto_nombre}
                    </span>
                    <span className="text-[var(--text-secondary)] flex-shrink-0 text-xs">
                      {p.unidades_vendidas} ud.
                    </span>
                    <span className="font-medium text-[var(--text-primary)] flex-shrink-0">
                      {fmt(Number(p.ingresos))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Bottom 10 */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)] mb-4">
              Bottom 10 menos vendidos
            </div>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : bottom10.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Sin datos en este período.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {bottom10.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="text-[var(--text-secondary)] w-5 flex-shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <span className="flex-1 text-[var(--text-primary)] truncate">
                      {p.producto_nombre}
                    </span>
                    <span className="text-[var(--text-secondary)] flex-shrink-0 text-xs">
                      {p.unidades_vendidas} ud.
                    </span>
                    <span className="font-medium text-[var(--text-primary)] flex-shrink-0">
                      {fmt(Number(p.ingresos))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
