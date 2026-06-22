'use client'

import { useState, useEffect } from 'react'
import { EstadoFichaje } from '@/types/fichajes'

interface Props {
  estadoInicial: EstadoFichaje
  onFichajeCompleto?: () => void
}

function pad(n: number) { return String(n).padStart(2, '0') }

function calcElapsed(entradaAt: string): string {
  const diff = Math.floor((Date.now() - new Date(entradaAt).getTime()) / 1000)
  return pad(Math.floor(diff / 3600)) + ':' + pad(Math.floor((diff % 3600) / 60)) + ':' + pad(diff % 60)
}

const DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export default function BotonFichaje({ estadoInicial, onFichajeCompleto }: Props) {
  const [estado, setEstado] = useState<EstadoFichaje>(estadoInicial)
  const [now, setNow] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState('')
  const [modal, setModal] = useState(false)
  const [nota, setNota] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!estado.abierto || !estado.entrada_at) { setElapsed(''); return }
    setElapsed(calcElapsed(estado.entrada_at))
    const t = setInterval(() => {
      if (estado.entrada_at) setElapsed(calcElapsed(estado.entrada_at))
    }, 1000)
    return () => clearInterval(t)
  }, [estado.abierto, estado.entrada_at])

  function abrirModal() { setError(null); setNota(''); setModal(true) }
  function cerrarModal() { if (cargando) return; setModal(false); setNota(''); setError(null) }

  async function confirmar() {
    setCargando(true)
    setError(null)
    const endpoint = estado.abierto ? '/api/fichajes/salida' : '/api/fichajes/entrada'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nota.trim() ? { nota: nota.trim() } : {}),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error desconocido'); setCargando(false); return }
      const estadoRes = await fetch('/api/fichajes/estado')
      const estadoJson = await estadoRes.json()
      setEstado(estadoJson.data as EstadoFichaje)
      setModal(false)
      setNota('')
      onFichajeCompleto?.()
    } catch {
      setError('Error de red. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  const working = estado.abierto
  const clock = now ? pad(now.getHours()) + ':' + pad(now.getMinutes()) : '--:--'
  const seconds = now ? ':' + pad(now.getSeconds()) : ':00'
  const dateLabel = now
    ? DAYS[now.getDay()] + ' · ' + now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear()
    : ''

  return (
    <>
      {/* ── Clock card ── */}
      <div style={{
        background: '#fff', border: '1px solid #e8e8ea', borderRadius: 18,
        padding: '26px 28px', boxShadow: '0 1px 2px rgba(20,23,29,0.04)',
        display: 'flex', alignItems: 'center', gap: 22,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '1.5px', color: '#a7a9af', marginBottom: 6 }}>
            {dateLabel}
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 44, fontWeight: 700, letterSpacing: '-1px', color: '#181b21', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            {clock}
            <span style={{ fontSize: 16, fontWeight: 500, color: '#b6b8bd', letterSpacing: 0 }}>{seconds}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f4f4f5', border: '1px solid #e9e9eb', borderRadius: 999, padding: '5px 12px 5px 10px' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: working ? '#16876a' : '#b6b8bd',
              boxShadow: working ? '0 0 0 3px rgba(22,135,106,0.16)' : '0 0 0 3px rgba(182,184,189,0.18)',
            }} />
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.4px', color: '#71757c' }}>
              {working ? 'EN JORNADA' : 'FUERA DE JORNADA'}
            </span>
          </div>
          {working && elapsed && (
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#9a9da3' }}>
              Jornada: {elapsed}
            </span>
          )}
        </div>
      </div>

      {/* ── Action button ── */}
      <button
        onClick={abrirModal}
        disabled={cargando}
        style={{
          width: '100%', height: 56, border: 'none', cursor: cargando ? 'default' : 'pointer',
          borderRadius: 14,
          background: working ? '#c0492f' : 'var(--accent)',
          color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, letterSpacing: '0.1px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: working ? '0 8px 20px rgba(192,73,47,0.22)' : '0 8px 20px rgba(31,93,76,0.20)',
          opacity: cargando ? 0.7 : 1,
          transition: 'filter .15s ease, opacity .15s ease',
        }}
      >
        {working ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
          </svg>
        )}
        {working ? 'Fichar salida' : 'Fichar entrada'}
      </button>

      {/* ── Modal ── */}
      {modal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 24 }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(20,23,29,0.18)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1b1e24', marginBottom: 20 }}>
              {working ? 'Confirmar salida' : 'Confirmar entrada'}
            </h2>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4d5159', letterSpacing: '0.1px' }}>
                Nota <span style={{ color: '#a7a9af', fontWeight: 400 }}>(opcional)</span>
              </span>
              <input
                type="text"
                value={nota}
                onChange={e => setNota(e.target.value)}
                disabled={cargando}
                placeholder="Añade una nota..."
                onKeyDown={e => e.key === 'Enter' && confirmar()}
                style={{
                  display: 'block', width: '100%', marginTop: 8,
                  border: '1.5px solid #e6e6e8', borderRadius: 10, padding: '10px 14px',
                  fontSize: 14, color: '#1b1e24', background: '#fcfcfd',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                autoFocus
              />
            </label>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={cerrarModal}
                disabled={cargando}
                style={{ flex: 1, height: 44, border: '1.5px solid #e6e6e8', borderRadius: 10, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#4d5159', cursor: 'pointer', opacity: cargando ? 0.5 : 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={cargando}
                style={{
                  flex: 1, height: 44, border: 'none', borderRadius: 10,
                  background: working ? '#c0492f' : 'var(--accent)',
                  color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                  cursor: cargando ? 'default' : 'pointer', opacity: cargando ? 0.7 : 1,
                }}
              >
                {cargando ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
