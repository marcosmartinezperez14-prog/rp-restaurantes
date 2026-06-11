'use client'

import { useState, useEffect } from 'react'
import { EstadoFichaje } from '@/types/fichajes'

interface Props {
  estadoInicial: EstadoFichaje
}

function formatReloj(d: Date): string {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function calcDuracion(entradaAt: string): string {
  const mins = Math.floor((Date.now() - new Date(entradaAt).getTime()) / 60_000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m} min`
}

export default function BotonFichaje({ estadoInicial }: Props) {
  const [estado, setEstado] = useState<EstadoFichaje>(estadoInicial)
  const [reloj, setReloj] = useState('')
  const [duracionLabel, setDuracionLabel] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)
  const [notaInput, setNotaInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Real-time clock — SSR-safe (starts empty, set only in client effect)
  useEffect(() => {
    setReloj(formatReloj(new Date()))
    const t = setInterval(() => setReloj(formatReloj(new Date())), 1_000)
    return () => clearInterval(t)
  }, [])

  // Duration counter — updates every 30 seconds when clocked in
  useEffect(() => {
    if (!estado.abierto || !estado.entrada_at) {
      setDuracionLabel('')
      return
    }
    setDuracionLabel(calcDuracion(estado.entrada_at))
    const t = setInterval(() => {
      if (estado.entrada_at) {
        setDuracionLabel(calcDuracion(estado.entrada_at))
      }
    }, 30_000)
    return () => clearInterval(t)
  }, [estado.abierto, estado.entrada_at])

  function abrirModal() {
    setErrorMsg(null)
    setNotaInput('')
    setMostrarModal(true)
  }

  function cerrarModal() {
    if (cargando) return
    setMostrarModal(false)
    setNotaInput('')
    setErrorMsg(null)
  }

  async function confirmarAccion() {
    setCargando(true)
    setErrorMsg(null)

    const endpoint = estado.abierto ? '/api/fichajes/salida' : '/api/fichajes/entrada'
    const body: { nota?: string } = {}
    if (notaInput.trim()) body.nota = notaInput.trim()

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: { ok: boolean; error?: string } = await res.json()

      if (!data.ok) {
        setErrorMsg(data.error ?? 'Error desconocido. Inténtalo de nuevo.')
        setCargando(false)
        return
      }

      // Refresh estado
      const estadoRes = await fetch('/api/fichajes/estado')
      const nuevoEstado: EstadoFichaje = await estadoRes.json()
      setEstado(nuevoEstado)
      setMostrarModal(false)
      setNotaInput('')
    } catch {
      setErrorMsg('Error de red. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const tituloModal = estado.abierto ? 'Confirmar salida' : 'Confirmar entrada'
  const colorBotonConfirmar = estado.abierto
    ? 'bg-red-500 hover:bg-red-600 text-white font-semibold'
    : 'bg-green-500 hover:bg-green-600 text-white font-semibold'

  return (
    <div className="w-full max-w-[430px] mx-auto px-4 py-6 space-y-4">
      {/* Clock card */}
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
        <p className="text-4xl font-mono font-bold text-gray-800 tracking-wider">
          {reloj}
        </p>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
        <div className="flex items-center gap-2">
          {estado.abierto ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Jornada abierta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
              Fuera de jornada
            </span>
          )}
        </div>

        {estado.abierto && duracionLabel && (
          <p className="text-sm text-gray-500 pl-1">
            Llevas <span className="font-semibold text-gray-700">{duracionLabel}</span>
          </p>
        )}
      </div>

      {/* Main action button */}
      <button
        onClick={abrirModal}
        disabled={cargando}
        className={`w-full py-4 rounded-2xl text-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          estado.abierto
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
      >
        {estado.abierto ? 'Fichar salida' : 'Fichar entrada'}
      </button>

      {/* Modal overlay */}
      {mostrarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModal()
          }}
        >
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-[400px] p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">{tituloModal}</h2>

            <div className="space-y-1">
              <label className="block text-sm text-gray-600">
                Nota <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={notaInput}
                onChange={(e) => setNotaInput(e.target.value)}
                disabled={cargando}
                placeholder="Añade una nota..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                style={{ color: 'black' }}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={cerrarModal}
                disabled={cargando}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarAccion}
                disabled={cargando}
                className={`flex-1 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorBotonConfirmar}`}
              >
                {cargando ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
