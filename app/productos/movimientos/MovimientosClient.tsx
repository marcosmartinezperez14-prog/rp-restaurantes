'use client'

import { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import type { MovimientoGlobal, StockStats, ProductoConCategoria } from '@/app/actions/productos'
import { getMovimientosGlobal } from '@/app/actions/productos'

const PAGE_SIZE = 50

const TYPE_CONFIG: Record<MovimientoGlobal['type'], {
  label: string; badge: string; sign: string; amountColor: string
}> = {
  compra: { label: 'Compra', badge: 'bg-green-50 text-green-700',  sign: '+', amountColor: 'text-green-700' },
  venta:  { label: 'Venta',  badge: 'bg-blue-50 text-blue-700',    sign: '-', amountColor: 'text-blue-700'  },
  ajuste: { label: 'Ajuste', badge: 'bg-amber-50 text-amber-700',  sign: '±', amountColor: 'text-amber-700' },
  merma:  { label: 'Merma',  badge: 'bg-red-50 text-red-600',      sign: '-', amountColor: 'text-red-600'   },
}

interface Props {
  initialData: { movements: MovimientoGlobal[]; total: number; stats: StockStats }
  products: ProductoConCategoria[]
}

export default function MovimientosClient({ initialData, products }: Props) {
  const [data, setData] = useState(initialData)
  const [tipo, setTipo] = useState('')
  const [productoId, setProductoId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()
  const reqRef = useRef(0)

  function fetchData(p: {
    tipo: string; productoId: string; fechaDesde: string; fechaHasta: string; page: number
  }) {
    const seq = ++reqRef.current
    setPage(p.page)
    startTransition(async () => {
      try {
        const fresh = await getMovimientosGlobal({
          tipo: (p.tipo as MovimientoGlobal['type']) || undefined,
          productoId: p.productoId || undefined,
          fechaDesde: p.fechaDesde || undefined,
          fechaHasta: p.fechaHasta || undefined,
          page: p.page,
        })
        if (seq === reqRef.current) setData(fresh)
      } catch {
        // Keep current data on error
      }
    })
  }

  function handleTipo(v: string) {
    setTipo(v)
    fetchData({ tipo: v, productoId, fechaDesde, fechaHasta, page: 1 })
  }
  function handleProducto(v: string) {
    setProductoId(v)
    fetchData({ tipo, productoId: v, fechaDesde, fechaHasta, page: 1 })
  }
  function handleFechaDesde(v: string) {
    setFechaDesde(v)
    fetchData({ tipo, productoId, fechaDesde: v, fechaHasta, page: 1 })
  }
  function handleFechaHasta(v: string) {
    setFechaHasta(v)
    fetchData({ tipo, productoId, fechaDesde, fechaHasta: v, page: 1 })
  }
  function handleLimpiar() {
    setTipo('')
    setProductoId('')
    setFechaDesde('')
    setFechaHasta('')
    fetchData({ tipo: '', productoId: '', fechaDesde: '', fechaHasta: '', page: 1 })
  }
  function handlePage(newPage: number) {
    fetchData({ tipo, productoId, fechaDesde, fechaHasta, page: newPage })
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE)
  const { stats } = data
  const hasFilters = !!(tipo || productoId || fechaDesde || fechaHasta)

  return (
    <div className={isPending ? 'opacity-60 pointer-events-none' : ''}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link href="/productos" className="text-blue-600 hover:underline">← Productos</Link>
        <span className="text-[var(--text-secondary)]">/</span>
        <span className="text-[var(--text-secondary)]">Movimientos de stock</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Compras</div>
          <div className="text-xl font-bold text-green-700 mt-1">+{stats.compras.total}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{stats.compras.count} movimientos</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Ventas</div>
          <div className="text-xl font-bold text-blue-700 mt-1">-{stats.ventas.total}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{stats.ventas.count} movimientos</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Ajustes</div>
          <div className="text-xl font-bold text-amber-700 mt-1">±{stats.ajustes.total}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{stats.ajustes.count} movimientos</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[var(--text-secondary)] tracking-wider">Mermas</div>
          <div className="text-xl font-bold text-red-600 mt-1">-{stats.mermas.total}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{stats.mermas.count} movimientos</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 py-3 flex gap-3 flex-wrap items-center mb-4">
        <select
          value={tipo}
          onChange={e => handleTipo(e.target.value)}
          className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-[var(--bg-surface)]"
        >
          <option value="">Todos los tipos</option>
          <option value="compra">Compra</option>
          <option value="venta">Venta</option>
          <option value="ajuste">Ajuste</option>
          <option value="merma">Merma</option>
        </select>
        <select
          value={productoId}
          onChange={e => handleProducto(e.target.value)}
          className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-[var(--bg-surface)] min-w-[160px]"
        >
          <option value="">Todos los productos</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={fechaDesde}
          onChange={e => handleFechaDesde(e.target.value)}
          aria-label="Fecha desde"
          className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
        />
        <span className="text-[var(--text-secondary)] text-sm">—</span>
        <input
          type="date"
          value={fechaHasta}
          onChange={e => handleFechaHasta(e.target.value)}
          aria-label="Fecha hasta"
          className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
        />
        {hasFilters && (
          <button
            onClick={handleLimpiar}
            className="ml-auto px-3 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)]"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-page)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Cantidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">P. Coste</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map(m => {
              const cfg = TYPE_CONFIG[m.type] ?? {
                label: m.type, badge: 'bg-[var(--bg-page)] text-[var(--text-secondary)]', sign: '', amountColor: 'text-[var(--text-secondary)]',
              }
              return (
                <tr key={m.id} className="border-b border-[#f1f5f9] hover:bg-[var(--bg-page)]">
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{m.product_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${cfg.amountColor}`}>
                    {cfg.sign}{m.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                    {m.cost_price !== null ? `${m.cost_price.toFixed(2)} €/u` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    <div className="max-w-[200px] truncate">{m.notes ?? '—'}</div>
                  </td>
                </tr>
              )
            })}
            {data.movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  Sin movimientos para los filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data.total > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              {data.total} movimientos · página {page} de {totalPages || 1}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-page)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
