'use client'

import { useState, useTransition } from 'react'
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

  function fetchData(p: {
    tipo: string; productoId: string; fechaDesde: string; fechaHasta: string; page: number
  }) {
    setPage(p.page)
    startTransition(async () => {
      const fresh = await getMovimientosGlobal({
        tipo: (p.tipo as MovimientoGlobal['type']) || undefined,
        productoId: p.productoId || undefined,
        fechaDesde: p.fechaDesde || undefined,
        fechaHasta: p.fechaHasta || undefined,
        page: p.page,
      })
      setData(fresh)
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
        <span className="text-[#94a3b8]">/</span>
        <span className="text-[#64748b]">Movimientos de stock</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Compras</div>
          <div className="text-xl font-bold text-green-700 mt-1">+{stats.compras.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.compras.count} movimientos</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Ventas</div>
          <div className="text-xl font-bold text-blue-700 mt-1">-{stats.ventas.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.ventas.count} movimientos</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Ajustes</div>
          <div className="text-xl font-bold text-amber-700 mt-1">±{stats.ajustes.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.ajustes.count} movimientos</div>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="text-[10px] uppercase font-semibold text-[#64748b] tracking-wider">Mermas</div>
          <div className="text-xl font-bold text-red-600 mt-1">-{stats.mermas.total}</div>
          <div className="text-xs text-[#94a3b8] mt-0.5">{stats.mermas.count} movimientos</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 flex gap-3 flex-wrap items-center mb-4">
        <select
          value={tipo}
          onChange={e => handleTipo(e.target.value)}
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-white"
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
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400 bg-white min-w-[160px]"
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
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
        />
        <span className="text-[#94a3b8] text-sm">—</span>
        <input
          type="date"
          value={fechaHasta}
          onChange={e => handleFechaHasta(e.target.value)}
          className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm text-black outline-none focus:border-blue-400"
        />
        {hasFilters && (
          <button
            onClick={handleLimpiar}
            className="ml-auto px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-[#e2e8f0]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">Cantidad</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#64748b] uppercase tracking-wider">P. Coste</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wider">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map(m => {
              const cfg = TYPE_CONFIG[m.type]
              return (
                <tr key={m.id} className="border-b border-[#f1f5f9] hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-[#64748b] whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('es-ES', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[#0f172a]">{m.product_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${cfg.amountColor}`}>
                    {cfg.sign}{m.quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-[#64748b]">
                    {m.cost_price !== null ? `${m.cost_price.toFixed(2)} €/u` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8] max-w-[200px] truncate">
                    {m.notes ?? '—'}
                  </td>
                </tr>
              )
            })}
            {data.movements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#94a3b8]">
                  Sin movimientos para los filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data.total > 0 && (
          <div className="px-4 py-3 border-t border-[#e2e8f0] flex items-center justify-between">
            <span className="text-xs text-[#64748b]">
              {data.total} movimientos · página {page} de {totalPages || 1}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-[#e2e8f0] rounded-lg text-[#64748b] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
