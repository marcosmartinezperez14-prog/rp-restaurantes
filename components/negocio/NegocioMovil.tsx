'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ResumenHoy, ActividadReciente } from '@/types/negocio'

function fmt(valor: number) {
  return valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function tiempoDesde(fecha: Date): string {
  const mins = Math.floor((Date.now() - fecha.getTime()) / 60_000)
  if (mins < 1) return 'AHORA MISMO'
  if (mins === 1) return 'HACE 1 MIN'
  return `HACE ${mins} MIN`
}

function horaDeISO(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fechaHoy(): string {
  const d = new Date()
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']
  const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${days[d.getDay()]}, ${d.getDate()} DE ${months[d.getMonth()]}`
}

function diferenciaVsAyer(hoy: number, ayer: number): { texto: string; positivo: boolean | null } {
  if (ayer === 0) return { texto: 'Sin datos de ayer', positivo: null }
  const pct = ((hoy - ayer) / ayer) * 100
  if (Math.abs(pct) < 0.5) return { texto: 'Igual que ayer', positivo: null }
  if (pct > 0) return { texto: `+${pct.toFixed(1)}% vs ayer`, positivo: true }
  return { texto: `${pct.toFixed(1)}% vs ayer`, positivo: false }
}

// ── Icon box ──────────────────────────────────────────────────────────────────

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f3f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ w, h }: { w: number | string; h: number }) {
  return <div style={{ width: w, height: h, background: '#ececee', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, loading, children }: { icon: React.ReactNode; label: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 15, padding: 18, boxShadow: '0 1px 2px rgba(20,23,29,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <IconBox>{icon}</IconBox>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6b6f77' }}>{label}</span>
      </div>
      {loading ? <Skel w={60} h={28} /> : children}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NegocioMovil() {
  const [resumen, setResumen]           = useState<ResumenHoy | null>(null)
  const [actividad, setActividad]       = useState<ActividadReciente[]>([])
  const [loadingResumen, setLoadingR]   = useState(true)
  const [loadingActividad, setLoadingA] = useState(true)
  const [errorResumen, setErrorR]       = useState<string | null>(null)
  const [ultimaAct, setUltimaAct]       = useState<Date | null>(null)
  const [tiempoLabel, setTiempoLabel]   = useState('AHORA MISMO')
  const [spinning, setSpinning]         = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarResumen = useCallback(async () => {
    setLoadingR(true); setErrorR(null)
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
    try {
      const res = await fetch('/api/negocio?tipo=actividad')
      const json = await res.json()
      if (!json.error) setActividad(json.data ?? [])
    } catch {}
    finally { setLoadingA(false) }
  }, [])

  const cargarTodo = useCallback(async () => {
    await Promise.all([cargarResumen(), cargarActividad()])
    const ahora = new Date()
    setUltimaAct(ahora)
    setTiempoLabel(tiempoDesde(ahora))
  }, [cargarResumen, cargarActividad])

  const recargar = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setSpinning(true)
    await cargarTodo()
    setSpinning(false)
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

  const diff = resumen ? diferenciaVsAyer(Number(resumen.ingresos_hoy), Number(resumen.ingresos_ayer)) : null

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#f6f6f7', display: 'flex', justifyContent: 'center', padding: '30px 22px 48px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* ── Header ── */}
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: '-0.6px', color: '#1b1e24' }}>Mi negocio</h1>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#9a9da3', letterSpacing: '0.3px', marginTop: 4 }}>
              {fechaHoy()}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <button
              onClick={recargar}
              style={{
                width: 38, height: 38, borderRadius: 10, border: '1px solid #e6e6e8',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'border-color .15s ease',
              }}
              aria-label="Recargar datos"
            >
              <svg
                width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="#4d5159" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: spinning ? 'spin 0.7s ease' : 'none' }}
              >
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16876a' }} />
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, color: '#9a9da3', letterSpacing: '0.2px' }}>
                {tiempoLabel}
              </span>
            </div>
          </div>
        </header>

        {/* ── Hero revenue ── */}
        {errorResumen ? (
          <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 18, padding: 24, marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>No se pudieron cargar los datos.</p>
            <button
              onClick={cargarResumen}
              style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 18, padding: 24, boxShadow: '0 1px 2px rgba(20,23,29,0.04)', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', color: '#9a9da3' }}>INGRESOS DE HOY</span>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#f3f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l5-5 4 3 6-7"/><path d="M17 8h3v3"/>
                </svg>
              </div>
            </div>

            {loadingResumen ? (
              <>
                <Skel w={180} h={44} />
                <div style={{ marginTop: 12 }}><Skel w={140} h={22} /></div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', color: '#181b21', lineHeight: 1 }}>
                  {fmt(Number(resumen?.ingresos_hoy ?? 0))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
                  {diff && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 600,
                      color: diff.positivo === true ? '#16876a' : diff.positivo === false ? '#c0492f' : '#9a9da3',
                      background: diff.positivo === true ? '#f0fdf4' : diff.positivo === false ? '#fef2f2' : '#f4f4f5',
                      borderRadius: 7, padding: '3px 9px',
                    }}>
                      {diff.positivo === true ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7"/></svg>
                      ) : diff.positivo === false ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l-7 7-7-7"/></svg>
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                      )}
                      {diff.texto}
                    </span>
                  )}
                  {diff?.positivo === null && (
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b6b8bd' }}>esperando primeras ventas</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 2×2 KPI grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

          <KpiCard loading={loadingResumen} label="Pedidos cerrados" icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2l1.5 4M18 2l-1.5 4M4 6h16l-1.4 12.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8z"/><path d="M9 11l2 2 4-4"/>
            </svg>
          }>
            <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.6px', color: '#181b21' }}>
              {resumen?.pedidos_cerrados ?? 0}
            </div>
          </KpiCard>

          <KpiCard loading={loadingResumen} label="Ticket medio" icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>
            </svg>
          }>
            <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.6px', color: '#181b21' }}>
              {fmt(Number(resumen?.ticket_medio ?? 0))}
            </div>
          </KpiCard>

          <KpiCard loading={loadingResumen} label="Mesas ocupadas" icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/>
            </svg>
          }>
            <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.6px', color: '#181b21' }}>
              {resumen?.mesas_ocupadas ?? 0}
              <span style={{ fontSize: 15, fontWeight: 600, color: '#b6b8bd' }}> / {resumen?.mesas_totales ?? 0}</span>
            </div>
          </KpiCard>

          <KpiCard loading={loadingResumen} label="Producto estrella" icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c7f86" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l2.5 5.2 5.5.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.5-.8z"/>
            </svg>
          }>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', color: resumen?.producto_estrella ? '#181b21' : '#b6b8bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {resumen?.producto_estrella ?? 'Sin datos aún'}
            </div>
          </KpiCard>
        </div>

        {/* ── Latest orders ── */}
        <div style={{ background: '#fff', border: '1px solid #e8e8ea', borderRadius: 16, padding: 20, boxShadow: '0 1px 2px rgba(20,23,29,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px', color: '#1b1e24' }}>Últimos pedidos de hoy</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#b6b8bd' }}>
              {actividad.length} hoy
            </span>
          </div>

          {loadingActividad ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
              {[...Array(3)].map((_, i) => <Skel key={i} w="100%" h={32} />)}
            </div>
          ) : actividad.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '26px 16px 14px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f5f5f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#c2c4c9" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h2l1.6 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H7"/>
                  <circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6b6f77' }}>Aún no hay pedidos cerrados hoy</div>
              <div style={{ fontSize: 12, color: '#a7a9af', marginTop: 4 }}>Los cobros aparecerán aquí en tiempo real.</div>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {actividad.map((a, i) => (
                <li key={a.pedido_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '11px 0',
                  borderTop: i > 0 ? '1px solid #f2f2f3' : 'none',
                }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1b1e24', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.mesa_nombre}
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#9a9da3', flexShrink: 0 }}>
                    {horaDeISO(a.cerrado_at)}
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600, color: '#181b21', flexShrink: 0 }}>
                    {fmt(Number(a.total))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}
