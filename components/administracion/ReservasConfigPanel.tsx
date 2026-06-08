'use client'

import { useState, useTransition } from 'react'
import type { ReservasConfig, Schedule, DiaSchedule } from '@/types/administracion'
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
    setConfig(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [key]: { ...prev.schedule[key], ...partial },
      },
    }))
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
        <div className="space-y-3">
          {DIAS.map(({ key, label }) => {
            const dia = config.schedule[key]
            return (
              <div key={key} className="flex items-center gap-4 py-2 border-b border-[var(--border)] last:border-0">
                {/* Toggle activo */}
                <button
                  onClick={() => setDia(key, { activo: !dia.activo })}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${dia.activo ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dia.activo ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>

                {/* Nombre del día */}
                <span className={`text-sm w-24 flex-shrink-0 ${dia.activo ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                  {label}
                </span>

                {dia.activo ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={dia.apertura}
                      onChange={e => setDia(key, { apertura: e.target.value })}
                      className="border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">hasta</span>
                    <input
                      type="time"
                      value={dia.cierre}
                      onChange={e => setDia(key, { cierre: e.target.value })}
                      className="border border-[var(--border)] rounded-lg px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">Cerrado</span>
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
