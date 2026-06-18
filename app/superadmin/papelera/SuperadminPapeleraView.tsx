'use client'

import { useState, useTransition } from 'react'
import {
  restaurarItem,
  eliminarDefinitivo,
  type TablaPapelera,
  type ItemPapelera,
  type DatosPapelera,
} from '@/app/actions/papelera'

interface Props {
  datos: DatosPapelera
}

interface ConfirmState {
  tabla: TablaPapelera
  id: string
  nombre: string
}

const SECCIONES: Array<{
  key: keyof DatosPapelera
  tabla: TablaPapelera
  titulo: string
  icono: string
}> = [
  { key: 'mesas',       tabla: 'tables',       titulo: 'Mesas',             icono: '🪑' },
  { key: 'zonas',       tabla: 'zones',        titulo: 'Zonas',             icono: '🗺️' },
  { key: 'categorias',  tabla: 'categories',   titulo: 'Categorías',        icono: '📂' },
  { key: 'platos',      tabla: 'menu_items',   titulo: 'Platos de carta',   icono: '🍽️' },
  { key: 'productos',   tabla: 'products',     titulo: 'Productos / stock', icono: '📦' },
  { key: 'usuarios',    tabla: 'users',        titulo: 'Usuarios',          icono: '👤' },
  { key: 'reservas',             tabla: 'reservations',            titulo: 'Reservas',              icono: '📅' },
  { key: 'movimientos',          tabla: 'movimientos',             titulo: 'Movimientos',           icono: '💰' },
  { key: 'gruposModificadores',  tabla: 'product_modifier_groups', titulo: 'Grupos modificadores',  icono: '🔧' },
  { key: 'opcionesModificadores',tabla: 'product_modifier_options',titulo: 'Opciones modificadores',icono: '⚙️' },
  { key: 'rolesPersonalizados',  tabla: 'roles',                    titulo: 'Roles personalizados',       icono: '🎭' },
  { key: 'turnos',               tabla: 'turnos',                   titulo: 'Turnos',                     icono: '🕐' },
  { key: 'diasLibres',           tabla: 'dias_libres',              titulo: 'Días libres',                icono: '🌴' },
  { key: 'solicitudesVacaciones',tabla: 'solicitudes_vacaciones',   titulo: 'Solicitudes de vacaciones',  icono: '✈️' },
]

export default function SuperadminPapeleraView({ datos: datosIniciales }: Props) {
  const [datos, setDatos] = useState<DatosPapelera>(datosIniciales)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = Object.values(datos).reduce((s, arr) => s + arr.length, 0)

  function mostrarToast(msg: string, tipo: 'ok' | 'err') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  function quitarItemLocal(tabla: TablaPapelera, id: string) {
    const keyMap: Record<TablaPapelera, keyof DatosPapelera> = {
      tables:                    'mesas',
      zones:                     'zonas',
      categories:                'categorias',
      menu_items:                'platos',
      products:                  'productos',
      users:                     'usuarios',
      reservations:              'reservas',
      movimientos:               'movimientos',
      product_modifier_groups:   'gruposModificadores',
      product_modifier_options:  'opcionesModificadores',
      roles:                     'rolesPersonalizados',
      turnos:                    'turnos',
      dias_libres:               'diasLibres',
      solicitudes_vacaciones:    'solicitudesVacaciones',
    }
    const key = keyMap[tabla]
    setDatos(prev => ({ ...prev, [key]: prev[key].filter(i => i.id !== id) }))
  }

  function handleRestaurar(tabla: TablaPapelera, item: ItemPapelera) {
    startTransition(async () => {
      const res = await restaurarItem(tabla, item.id)
      if (res.error) { mostrarToast(res.error, 'err'); return }
      quitarItemLocal(tabla, item.id)
      mostrarToast(`"${item.nombre}" restaurado correctamente.`, 'ok')
    })
  }

  function handleEliminarClick(tabla: TablaPapelera, item: ItemPapelera) {
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
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">Papelera</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Elementos eliminados de forma lógica. Puedes restaurarlos o borrarlos definitivamente.
        </p>
        {total === 0 && (
          <div className="mt-10 py-16 text-center text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded-2xl">
            <p className="text-4xl mb-3">🗑️</p>
            <p className="text-sm">La papelera está vacía.</p>
          </div>
        )}
      </div>

      {SECCIONES.map(({ key, tabla, titulo, icono }) => {
        const items = datos[key]
        if (items.length === 0) return null
        return (
          <section key={tabla} className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{icono}</span>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide">{titulo}</h2>
              <span className="ml-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100 border border-[var(--border)] rounded-xl overflow-hidden">
              {items.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-page)] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {item.nombre}
                      {item.extra && (
                        <span className="ml-2 text-xs text-[var(--text-secondary)] font-normal">{item.extra}</span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {item.restaurante}
                      {item.deleted_at && (
                        <> · {new Date(item.deleted_at).toLocaleDateString('es-ES', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      disabled={isPending}
                      onClick={() => handleRestaurar(tabla, item)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-page)] disabled:opacity-50 transition-colors"
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

      {/* Modal confirmación */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={() => setConfirm(null)}
        >
          <div
            className="bg-[var(--bg-surface)] rounded-xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-base font-semibold text-[var(--text-primary)] mb-2">¿Eliminar definitivamente?</p>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Esta acción borrará{' '}
              <span className="font-medium text-gray-800">"{confirm.nombre}"</span>{' '}
              de la base de datos de forma permanente y no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-page)] transition-colors"
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
            toast.tipo === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
