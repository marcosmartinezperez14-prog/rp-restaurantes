'use client'

import { useState, useTransition } from 'react'
import AppShell from '@/components/AppShell'
import {
  restaurarItem,
  eliminarDefinitivo,
  type TablaFase1,
  type ItemPapelera,
  type PapeleraFase1,
} from '@/app/actions/papelera'

interface Props {
  datos: PapeleraFase1
}

interface ConfirmState {
  tabla: TablaFase1
  id: string
  nombre: string
}

const SECCIONES: Array<{
  key: keyof PapeleraFase1
  tabla: TablaFase1
  titulo: string
  icono: string
}> = [
  { key: 'mesas',      tabla: 'tables',     titulo: 'Mesas',             icono: '🪑' },
  { key: 'zonas',      tabla: 'zones',      titulo: 'Zonas',             icono: '🗺️' },
  { key: 'categorias', tabla: 'categories', titulo: 'Categorías',        icono: '📂' },
  { key: 'platos',     tabla: 'menu_items', titulo: 'Platos de carta',   icono: '🍽️' },
  { key: 'productos',  tabla: 'products',   titulo: 'Productos / stock', icono: '📦' },
  { key: 'usuarios',   tabla: 'users',      titulo: 'Usuarios',          icono: '👤' },
]

export default function PapeleraView({ datos: datosIniciales }: Props) {
  const [datos, setDatos] = useState<PapeleraFase1>(datosIniciales)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = Object.values(datos).reduce((s, arr) => s + arr.length, 0)

  function mostrarToast(msg: string, tipo: 'ok' | 'err') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  function quitarItemLocal(tabla: TablaFase1, id: string) {
    const keyMap: Record<TablaFase1, keyof PapeleraFase1> = {
      tables:     'mesas',
      zones:      'zonas',
      categories: 'categorias',
      menu_items: 'platos',
      products:   'productos',
      users:      'usuarios',
    }
    const key = keyMap[tabla]
    setDatos(prev => ({ ...prev, [key]: prev[key].filter(i => i.id !== id) }))
  }

  function handleRestaurar(tabla: TablaFase1, item: ItemPapelera) {
    startTransition(async () => {
      const res = await restaurarItem(tabla, item.id)
      if (res.error) { mostrarToast(res.error, 'err'); return }
      quitarItemLocal(tabla, item.id)
      mostrarToast(`"${item.nombre}" restaurado correctamente.`, 'ok')
    })
  }

  function handleEliminarClick(tabla: TablaFase1, item: ItemPapelera) {
    setConfirm({ tabla, id: item.id, nombre: item.nombre })
  }

  function handleEliminarConfirmar() {
    if (!confirm) return
    const { tabla, id, nombre } = confirm
    setConfirm(null)
    startTransition(async () => {
      const res = await eliminarDefinitivo(tabla, id)
      if (res.error) { mostrarToast(res.error, 'err'); return }
      quitarItemLocal(tabla, id)
      mostrarToast(`"${nombre}" eliminado definitivamente.`, 'ok')
    })
  }

  return (
    <AppShell title="Papelera">
      <div className="max-w-4xl mx-auto">
        {/* Cabecera */}
        <div className="mb-8">
          <p className="text-sm text-[var(--text-secondary)]">
            Solo visible para <span className="font-semibold text-[var(--text-primary)]">superadmin</span>.
            Los elementos aquí listados han sido eliminados de forma lógica y aún no se han borrado de la base de datos.
          </p>
          {total === 0 && (
            <div className="mt-6 py-16 text-center text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-2xl">
              <p className="text-4xl mb-3">🗑️</p>
              <p className="text-sm">La papelera está vacía.</p>
            </div>
          )}
        </div>

        {/* Secciones */}
        {SECCIONES.map(({ key, tabla, titulo, icono }) => {
          const items = datos[key]
          if (items.length === 0) return null
          return (
            <section key={tabla} className="mb-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{icono}</span>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{titulo}</h2>
                <span className="ml-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {item.nombre}
                        {item.extra && (
                          <span className="ml-2 text-xs text-[var(--text-secondary)] font-normal">
                            {item.extra}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {item.restaurante}
                        {item.deleted_at && (
                          <> · eliminado el {new Date(item.deleted_at).toLocaleDateString('es-ES', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        disabled={isPending}
                        onClick={() => handleRestaurar(tabla, item)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 transition-colors"
                      >
                        Restaurar
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handleEliminarClick(tabla, item)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                      >
                        Eliminar definitivamente
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Modal de confirmación de eliminación definitiva */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={() => setConfirm(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-gray-900 mb-2">
              ¿Eliminar definitivamente?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Esta acción borrará{' '}
              <span className="font-medium text-gray-800">"{confirm.nombre}"</span>{' '}
              de la base de datos de forma permanente y no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarConfirmar}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg ${
            toast.tipo === 'ok'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </AppShell>
  )
}
