'use client'

import { useState, useEffect } from 'react'
import type { ModifierGroup, ModifierSelection, ModifierSnapshot, ItemConModificadores } from '@/types/modificadores'

interface Props {
  menuItem: { id: string; name: string; price: number }
  cantidadMinima?: number
  onConfirmar: (resultado: ItemConModificadores) => void
  onCancelar: () => void
}

function fmt(v: number) {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function SelectorModificadores({ menuItem, cantidadMinima = 1, onConfirmar, onCancelar }: Props) {
  const [grupos, setGrupos] = useState<ModifierGroup[]>([])
  const [cargando, setCargando] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selecciones, setSelecciones] = useState<ModifierSelection[]>([])
  const [nota, setNota] = useState('')
  const [cantidad, setCantidad] = useState(cantidadMinima)
  const [erroresGrupos, setErroresGrupos] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const res = await fetch(`/api/modificadores/${menuItem.id}`)
        const json = await res.json()
        if (cancelled) return
        const data: ModifierGroup[] = json.data ?? []

        if (data.length === 0) {
          onConfirmar({ menu_item_id: menuItem.id, cantidad: cantidadMinima, precio_final: menuItem.price, modifiers_snapshot: [] })
          return
        }

        setGrupos(data)
        setSelecciones(data.map(g => ({
          group_id: g.id,
          option_ids: g.options.filter(o => o.is_default).map(o => o.id),
        })))
        setCargando(false)
      } catch {
        if (!cancelled) {
          setFetchError('No se pudieron cargar las opciones')
          setCargando(false)
        }
      }
    }
    cargar()
    return () => { cancelled = true }
  }, [menuItem.id, menuItem.price, cantidadMinima, onConfirmar])

  function toggleOpcion(groupId: string, optionId: string, allowsMultiple: boolean) {
    setSelecciones(prev => prev.map(s => {
      if (s.group_id !== groupId) return s
      if (s.option_ids.includes(optionId)) {
        return { ...s, option_ids: s.option_ids.filter(id => id !== optionId) }
      }
      if (!allowsMultiple) return { ...s, option_ids: [optionId] }
      return { ...s, option_ids: [...s.option_ids, optionId] }
    }))
    setErroresGrupos(prev => { const n = new Set(prev); n.delete(groupId); return n })
  }

  const varianteSeleccionada = grupos
    .filter(g => g.type === 'variante')
    .flatMap(g => {
      const sel = selecciones.find(s => s.group_id === g.id)
      return (sel?.option_ids ?? []).map(id => g.options.find(o => o.id === id)!)
    })
    .filter(Boolean)[0]

  const suplementos = grupos
    .filter(g => g.type === 'modificador')
    .flatMap(g => {
      const sel = selecciones.find(s => s.group_id === g.id)
      return (sel?.option_ids ?? []).map(id => g.options.find(o => o.id === id)!).filter(Boolean)
    })
    .reduce((sum, o) => sum + Number(o.price_delta), 0)

  const precioFinal = varianteSeleccionada
    ? Number(varianteSeleccionada.price_delta)
    : menuItem.price + suplementos

  function handleConfirmar() {
    const faltantes = new Set<string>()
    for (const g of grupos) {
      if (g.required) {
        const sel = selecciones.find(s => s.group_id === g.id)
        if (!sel || sel.option_ids.length === 0) faltantes.add(g.id)
      }
    }
    if (faltantes.size > 0) { setErroresGrupos(faltantes); return }

    const snapshot: ModifierSnapshot[] = selecciones.flatMap(sel => {
      const grupo = grupos.find(g => g.id === sel.group_id)!
      return sel.option_ids.map(optId => {
        const opcion = grupo.options.find(o => o.id === optId)!
        return {
          group_id: grupo.id,
          group_name: grupo.name,
          group_type: grupo.type,
          option_id: opcion.id,
          option_name: opcion.name,
          price_delta: Number(opcion.price_delta),
        }
      })
    })

    onConfirmar({
      menu_item_id: menuItem.id,
      cantidad,
      precio_final: precioFinal,
      modifiers_snapshot: snapshot,
      nota: nota.trim() || undefined,
    })
  }

  if (cargando) return null

  if (fetchError) return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancelar}
    >
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
        <p className="text-sm text-red-600 mb-4">{fetchError}</p>
        <button onClick={onCancelar} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-page)]">
          Cerrar
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancelar() }}
    >
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Cabecera */}
        <div className="p-5 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{menuItem.name}</h2>
          <p className="text-sm text-[var(--text-secondary)]">Personaliza tu pedido</p>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {grupos.map(grupo => {
            const sel = selecciones.find(s => s.group_id === grupo.id)
            const hayError = erroresGrupos.has(grupo.id)
            return (
              <div key={grupo.id}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-semibold text-sm text-[var(--text-primary)]">{grupo.name}</span>
                  {grupo.required && (
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-semibold ${hayError ? 'bg-red-100 text-red-700' : 'bg-red-50 text-red-600'}`}>
                      Obligatorio
                    </span>
                  )}
                  {grupo.type === 'modificador' && grupo.allows_multiple && (
                    <span className="text-[10px] text-[var(--text-secondary)]">(varios)</span>
                  )}
                </div>
                {hayError && (
                  <p className="text-xs text-red-600 mb-1">Selección obligatoria</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {grupo.options.map(opcion => {
                    const seleccionado = (sel?.option_ids ?? []).includes(opcion.id)
                    const esRadio = grupo.type === 'variante' || !grupo.allows_multiple
                    return (
                      <label
                        key={opcion.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${seleccionado ? 'border-blue-500 bg-blue-50' : 'border-[var(--border)] hover:bg-[var(--bg-page)]'}`}
                      >
                        <input
                          type={esRadio ? 'radio' : 'checkbox'}
                          name={esRadio ? grupo.id : undefined}
                          checked={seleccionado}
                          onChange={() => toggleOpcion(grupo.id, opcion.id, grupo.allows_multiple && grupo.type === 'modificador')}
                          className="accent-blue-600"
                        />
                        <span className="flex-1 text-sm text-[var(--text-primary)]">{opcion.name}</span>
                        <span className="text-sm text-[var(--text-secondary)] flex-shrink-0">
                          {grupo.type === 'variante'
                            ? fmt(Number(opcion.price_delta))
                            : opcion.price_delta > 0
                              ? `+${fmt(Number(opcion.price_delta))}`
                              : '—'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Nota libre */}
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
              Nota para cocina (opcional)
            </label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value.slice(0, 200))}
              placeholder="Alergias, preferencias, sin sal..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--border)] flex-shrink-0 space-y-3">
          {/* Desglose de precio */}
          <div className="text-sm text-[var(--text-secondary)] space-y-0.5">
            {varianteSeleccionada && (
              <p>Precio variante: <span className="font-semibold text-[var(--text-primary)]">{fmt(Number(varianteSeleccionada.price_delta))}</span></p>
            )}
            {!varianteSeleccionada && suplementos > 0 && (
              <p>Base {fmt(menuItem.price)} + suplementos {fmt(suplementos)}</p>
            )}
            <p className="text-lg font-bold text-[var(--text-primary)]">Total: {fmt(precioFinal)}</p>
          </div>

          {/* Cantidad */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-secondary)]">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCantidad(c => Math.max(cantidadMinima, c - 1))}
                className="w-8 h-8 rounded-full border border-gray-300 text-[var(--text-primary)] font-bold flex items-center justify-center hover:bg-[var(--bg-page)]"
              >−</button>
              <span className="text-base font-semibold text-[var(--text-primary)] w-6 text-center">{cantidad}</span>
              <button
                onClick={() => setCantidad(c => c + 1)}
                className="w-8 h-8 rounded-full border border-gray-300 text-[var(--text-primary)] font-bold flex items-center justify-center hover:bg-[var(--bg-page)]"
              >+</button>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button
              onClick={onCancelar}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--bg-page)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              className="flex-1 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--accent-hover)]"
            >
              Añadir al pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
