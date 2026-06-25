'use client'

import { useState, useEffect, useMemo } from 'react'
import type { CategoriaCarta } from '@/app/api/cliente/[slug]/carta/route'
import type { ReservasConfig, Schedule } from '@/types/administracion'

const DIA_MAP: Record<number, keyof Schedule> = {
  0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles',
  4: 'jueves', 5: 'viernes', 6: 'sabado',
}

function generarSlots(fecha: string, config: ReservasConfig): string[] {
  if (!fecha) return []
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const diaSemana = new Date(anio, mes - 1, dia).getDay()
  const diaConfig = config.schedule[DIA_MAP[diaSemana]]
  if (!diaConfig?.activo) return []

  const slots: string[] = []
  const intervalo = 30
  for (const franja of diaConfig.franjas) {
    const [hA, mA] = franja.apertura.split(':').map(Number)
    const [hC, mC] = franja.cierre.split(':').map(Number)
    let minutos = hA * 60 + mA
    const fin = hC * 60 + mC - config.duration_minutes
    while (minutos <= fin) {
      const h = String(Math.floor(minutos / 60)).padStart(2, '0')
      const m = String(minutos % 60).padStart(2, '0')
      slots.push(`${h}:${m}`)
      minutos += intervalo
    }
  }
  return slots
}

interface Props {
  restaurante: { id: string; name: string; slug: string; max_online_comensales: number | null }
  carta: CategoriaCarta[]
  reservasConfig: ReservasConfig
}

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@300;400;500&display=swap');
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #EDEAE3; font-family: 'Jost', system-ui, sans-serif; -webkit-font-smoothing: antialiased; color: #211E1A; }
  .hscroll::-webkit-scrollbar { display: none; }
  .hscroll { scrollbar-width: none; }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`

export default function CartaPublicaClient({ restaurante, carta, reservasConfig }: Props) {
  const { name: nombre, max_online_comensales } = restaurante

  const [activeSection, setActiveSection] = useState(carta[0]?.id ?? '')
  const [reservaOpen, setReservaOpen] = useState(false)
  const [reservaDone, setReservaDone] = useState(false)
  const [pax, setPax] = useState('2')
  const [resvName, setResvName] = useState('')
  const [resvDate, setResvDate] = useState(() => {
    const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset())
    return t.toISOString().slice(0, 10)
  })
  const [resvTime, setResvTime] = useState('')
  const [resvDoneMsg, setResvDoneMsg] = useState('')

  const slots = useMemo(() => generarSlots(resvDate, reservasConfig), [resvDate, reservasConfig])

  useEffect(() => {
    if (slots.length > 0 && !slots.includes(resvTime)) {
      setResvTime(slots[0])
    }
  }, [slots])

  const [gateConfirmado, setGateConfirmado] = useState(max_online_comensales === null)
  const [gateComensales, setGateComensales] = useState(1)
  const [grupoGrande, setGrupoGrande] = useState(false)

  const destacados = carta.flatMap(c => c.items).filter(i => i.imagen_url).slice(0, 3)

  useEffect(() => {
    if (!gateConfirmado) return
    const ids = carta.map(c => c.id)
    const handleScroll = () => {
      let cur = ids[0] ?? ''
      for (const id of ids) {
        const el = document.getElementById(`cat-${id}`)
        if (el && el.getBoundingClientRect().top <= 160) cur = id
      }
      setActiveSection(cur)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [carta, gateConfirmado])

  function handleContinuarGate() {
    if (max_online_comensales !== null && gateComensales >= max_online_comensales) {
      setGrupoGrande(true)
    } else {
      setGateConfirmado(true)
    }
  }

  function handleConfirmarReserva() {
    let dlabel = resvDate
    try { dlabel = new Date(resvDate + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) } catch { /* */ }
    const who = resvName.trim() || 'ti'
    setResvDoneMsg(`Mesa para ${pax} ${pax === '1' ? 'persona' : 'personas'} el ${dlabel} a las ${resvTime}, a nombre de ${who}.`)
    setReservaDone(true)
  }

  const paxOptions = ['1', '2', '3', '4', '5', '6+']

  return (
    <div style={{ minHeight: '100vh', background: '#EDEAE3', display: 'flex', justifyContent: 'center' }}>
      <style>{FONTS}</style>

      <div style={{ width: '100%', maxWidth: '540px', background: '#F8F6F0', position: 'relative', overflow: 'hidden' }}>

        {/* App bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', background: 'rgba(248,246,240,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '21px', color: '#211E1A', letterSpacing: '0.04em' }}>Carta</span>
          <span style={{ fontSize: '11px', fontWeight: 400, color: '#AFA89A', letterSpacing: '0.08em' }}>Abierto</span>
        </div>

        {/* Hero */}
        <div style={{ padding: '64px 32px 56px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 24px', fontSize: '10.5px', fontWeight: 400, letterSpacing: '0.4em', textTransform: 'uppercase', color: '#9E4F2E' }}>Carta del restaurante</p>
          <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '72px', lineHeight: 0.95, color: '#211E1A', letterSpacing: '0.01em' }}>Nuestra carta</h1>
          <p style={{ margin: '26px auto 0', maxWidth: '300px', fontSize: '14px', fontWeight: 300, lineHeight: 1.7, color: '#837C70' }}>Disfruta de nuestra selección de platos. Escanea, elige y disfruta.</p>
          <div style={{ display: 'flex', gap: '0', justifyContent: 'center', marginTop: '38px' }}>
            <button
              onClick={() => { setReservaDone(false); setReservaOpen(true) }}
              style={{ cursor: 'pointer', padding: '13px 28px', border: 'none', background: 'none', color: '#211E1A', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderBottom: '1px solid #211E1A' }}
            >
              Reservar
            </button>
            <a href="#menu" style={{ cursor: 'pointer', padding: '13px 28px', background: 'none', color: '#AFA89A', textDecoration: 'none', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderBottom: '1px solid transparent' }}>
              Ver la carta
            </a>
          </div>
        </div>

        {/* Destacados */}
        {destacados.length > 0 && (
          <div style={{ padding: '8px 0 14px' }}>
            <div className="hscroll" style={{ display: 'flex', gap: '20px', overflowX: 'auto', padding: '2px 32px 12px', scrollSnapType: 'x mandatory' }}>
              {destacados.map(item => (
                <div key={item.id} style={{ flex: 'none', width: '200px', scrollSnapAlign: 'start' }}>
                  <img src={item.imagen_url!} alt={item.nombre} style={{ width: '100%', height: '250px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '19px', color: '#211E1A' }}>{item.nombre}</span>
                    <span style={{ fontWeight: 300, fontSize: '13px', color: '#AFA89A', whiteSpace: 'nowrap' }}>{item.precio.toFixed(2)} €</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gate de comensales */}
        {grupoGrande ? (
          <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '28px', color: '#211E1A', margin: 0, lineHeight: 1.3 }}>
              Para grupos de {max_online_comensales} o más personas, contacta con nosotros directamente.
            </p>
            <button onClick={() => setGrupoGrande(false)} style={{ border: 'none', cursor: 'pointer', padding: '13px 28px', background: 'none', color: '#211E1A', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderBottom: '1px solid #211E1A' }}>
              Volver
            </button>
          </div>
        ) : !gateConfirmado ? (
          <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '28px', color: '#211E1A', margin: 0, lineHeight: 1.3 }}>¿Cuántas personas sois?</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              <button onClick={() => setGateComensales(n => Math.max(1, n - 1))} disabled={gateComensales <= 1} style={{ width: '36px', height: '36px', border: '1px solid rgba(33,30,26,0.2)', background: 'none', color: '#211E1A', fontSize: '18px', cursor: 'pointer', opacity: gateComensales <= 1 ? 0.3 : 1, borderRadius: 0 }}>−</button>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '40px', fontWeight: 400, color: '#211E1A', minWidth: '32px', textAlign: 'center' }}>{gateComensales}</span>
              <button onClick={() => setGateComensales(n => n + 1)} style={{ width: '36px', height: '36px', border: '1px solid rgba(33,30,26,0.2)', background: 'none', color: '#211E1A', fontSize: '18px', cursor: 'pointer', borderRadius: 0 }}>+</button>
            </div>
            <button onClick={handleContinuarGate} style={{ border: 'none', cursor: 'pointer', padding: '13px 36px', background: '#211E1A', color: '#F8F6F0', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderRadius: 0 }}>
              Continuar
            </button>
          </div>
        ) : (
          <>
            {/* Sticky category nav */}
            {carta.length > 1 && (
              <div id="catnav" style={{ position: 'sticky', top: '62px', zIndex: 30, padding: '15px 0', background: 'rgba(248,246,240,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(33,30,26,0.06)' }}>
                <div className="hscroll" style={{ display: 'flex', gap: '28px', overflowX: 'auto', padding: '0 32px' }}>
                  {carta.map(cat => {
                    const active = activeSection === cat.id
                    return (
                      <a key={cat.id} href={`#cat-${cat.id}`} style={{ flex: 'none', textDecoration: 'none', color: active ? '#211E1A' : '#AFA89A', fontWeight: 400, fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase', transition: 'color 0.15s' }}>
                        {cat.nombre}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Secciones del menú */}
            <div id="menu" style={{ padding: '14px 32px 0' }}>
              {carta.map(categoria => (
                <section key={categoria.id} id={`cat-${categoria.id}`} style={{ scrollMarginTop: '120px', padding: '40px 0 10px' }}>
                  <h3 style={{ margin: '0 0 22px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '15px', fontStyle: 'italic', color: '#9E4F2E', letterSpacing: '0.02em' }}>
                    {categoria.nombre}
                  </h3>

                  {categoria.items.map((item, idx) => {
                    const isLast = idx === categoria.items.length - 1
                    return (
                      <div key={item.id} style={{ padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid rgba(33,30,26,0.07)' }}>
                        {item.imagen_url && (
                          <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block', marginBottom: '12px' }} />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '20px' }}>
                          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '20px', color: '#211E1A' }}>{item.nombre}</span>
                          <span style={{ fontWeight: 300, fontSize: '15px', color: '#211E1A', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.precio.toFixed(2)} €</span>
                        </div>
                        {item.descripcion && (
                          <p style={{ margin: '4px 0 0', fontSize: '12.5px', fontWeight: 300, color: '#837C70', lineHeight: 1.5 }}>{item.descripcion}</p>
                        )}
                      </div>
                    )
                  })}
                </section>
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: '36px', padding: '56px 32px 60px', textAlign: 'center', borderTop: '1px solid rgba(33,30,26,0.1)' }}>
              <h3 style={{ margin: '0 0 14px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '34px', color: '#211E1A', letterSpacing: '0.01em' }}>¿Te apetece?</h3>
              <p style={{ margin: '0 auto 30px', maxWidth: '280px', color: '#837C70', fontSize: '13.5px', fontWeight: 300, lineHeight: 1.7 }}>Reserva tu mesa y te guardamos sitio.</p>
              <button
                onClick={() => { setReservaDone(false); setReservaOpen(true) }}
                style={{ cursor: 'pointer', padding: '13px 32px', border: 'none', background: 'none', color: '#211E1A', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderBottom: '1px solid #211E1A' }}
              >
                Reservar mesa
              </button>
              <div style={{ marginTop: '46px', fontSize: '12.5px', fontWeight: 300, color: '#AFA89A', lineHeight: 1.9, letterSpacing: '0.02em' }}>
                <div>Powered by GestionBar</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reservation bottom sheet */}
      {reservaOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setReservaOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.45)', animation: 'fadeIn 0.2s ease' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '540px', background: '#F8F6F0', padding: '34px 32px 38px', animation: 'sheetUp 0.32s cubic-bezier(0.16,1,0.3,1)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ width: '36px', height: '2px', background: 'rgba(33,30,26,0.2)', margin: '0 auto 30px' }} />

            {!reservaDone ? (
              <div>
                <h3 style={{ margin: '0 0 30px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '30px', color: '#211E1A', textAlign: 'center' }}>Reservar mesa</h3>

                <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 400, color: '#AFA89A', marginBottom: '14px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>¿Cuántos sois?</label>
                <div style={{ display: 'flex', gap: '0', marginBottom: '26px', borderBottom: '1px solid rgba(33,30,26,0.12)' }}>
                  {paxOptions.map(v => (
                    <button key={v} onClick={() => setPax(v)} style={{ flex: 1, cursor: 'pointer', padding: '12px 0', border: 'none', background: pax === v ? '#211E1A' : 'none', fontFamily: "'Jost', sans-serif", fontWeight: 300, fontSize: '15px', color: pax === v ? '#F8F6F0' : '#211E1A', borderRadius: 0 }}>
                      {v}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '18px', marginBottom: '26px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 400, color: '#AFA89A', marginBottom: '12px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Día</label>
                    <input type="date" value={resvDate} onChange={e => setResvDate(e.target.value)} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid rgba(33,30,26,0.18)', background: 'none', fontFamily: "'Jost', sans-serif", fontSize: '14px', color: '#211E1A' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 400, color: '#AFA89A', marginBottom: '12px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Hora</label>
                    {slots.length > 0 ? (
                      <select value={resvTime} onChange={e => setResvTime(e.target.value)} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid rgba(33,30,26,0.18)', background: 'none', fontFamily: "'Jost', sans-serif", fontSize: '14px', color: '#211E1A' }}>
                        {slots.map(t => <option key={t}>{t}</option>)}
                      </select>
                    ) : (
                      <p style={{ margin: '10px 0 0', fontSize: '12.5px', fontWeight: 300, color: '#9E4F2E' }}>Sin disponibilidad ese día</p>
                    )}
                  </div>
                </div>

                <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 400, color: '#AFA89A', marginBottom: '12px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>A nombre de</label>
                <input type="text" placeholder="Tu nombre" value={resvName} onChange={e => setResvName(e.target.value)} style={{ width: '100%', padding: '10px 0', border: 'none', borderBottom: '1px solid rgba(33,30,26,0.18)', background: 'none', fontFamily: "'Jost', sans-serif", fontSize: '14px', color: '#211E1A', marginBottom: '34px' }} />

                <button onClick={handleConfirmarReserva} disabled={slots.length === 0} style={{ width: '100%', border: 'none', cursor: slots.length === 0 ? 'default' : 'pointer', padding: '16px', background: slots.length === 0 ? '#AFA89A' : '#211E1A', color: '#F8F6F0', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderRadius: 0, transition: 'background 0.15s' }}>
                  Confirmar reserva
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '14px 0 8px' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '50%', border: '1px solid #9E4F2E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: '#9E4F2E', fontSize: '22px' }}>✓</div>
                <h3 style={{ margin: '0 0 10px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '28px', color: '#211E1A' }}>Mesa reservada</h3>
                <p style={{ margin: '0 0 30px', color: '#837C70', fontSize: '13.5px', fontWeight: 300, lineHeight: 1.7 }}>{resvDoneMsg}</p>
                <button onClick={() => setReservaOpen(false)} style={{ width: '100%', border: 'none', cursor: 'pointer', padding: '15px', background: '#211E1A', color: '#F8F6F0', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderRadius: 0 }}>
                  Hecho
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
