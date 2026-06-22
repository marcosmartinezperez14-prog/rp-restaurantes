'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { CategoriaCarta } from '@/app/api/cliente/[slug]/carta/route'

interface Props {
  restaurante: { id: string; name: string; slug: string; max_online_comensales: number | null }
  carta: CategoriaCarta[]
}

export default function CartaPublicaClient({ restaurante, carta }: Props) {
  const { name: nombre, slug, max_online_comensales } = restaurante
  const logoLetra = nombre.charAt(0).toLowerCase()

  const [activeSection, setActiveSection] = useState(carta[0]?.id ?? '')
  const [reservaOpen, setReservaOpen] = useState(false)
  const [reservaDone, setReservaDone] = useState(false)
  const [pax, setPax] = useState('2')
  const [resvName, setResvName] = useState('')
  const [resvDate, setResvDate] = useState(() => {
    const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset())
    return t.toISOString().slice(0, 10)
  })
  const [resvTime, setResvTime] = useState('20:30')
  const [resvDoneMsg, setResvDoneMsg] = useState('')

  // CartaGate state
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
    <div style={{ minHeight: '100vh', background: '#EFE9DC', display: 'flex', justifyContent: 'center', padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap');
        .hscroll::-webkit-scrollbar { display: none; }
        .hscroll { scrollbar-width: none; }
        .carta-body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .font-bg { font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div className="carta-body" style={{ width: '100%', maxWidth: '540px', background: '#F6F2E9', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(20,20,26,0.08)' }}>

        {/* App bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(246,242,233,0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(20,20,26,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div className="font-bg" style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#2C4BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '15px' }}>
              {logoLetra}
            </div>
            <span className="font-bg" style={{ fontWeight: 700, fontSize: '17px', color: '#15151B', letterSpacing: '-0.01em' }}>
              {nombre.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: '18px 20px 8px' }}>
          <div style={{ position: 'relative', background: '#2C4BFF', borderRadius: '30px', padding: '34px 26px 28px', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #5C77FF, #2C4BFF)', opacity: 0.7 }} />
            <div style={{ position: 'absolute', bottom: '-46px', left: '-30px', width: '120px', height: '120px', borderRadius: '34px', background: '#FF5A36', opacity: 0.9, transform: 'rotate(18deg)' }} />
            <div style={{ position: 'relative' }}>
              <span style={{ display: 'inline-block', padding: '5px 12px', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '999px', color: '#EAEFFF', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Carta del restaurante
              </span>
              <h1 className="font-bg" style={{ margin: '16px 0 6px', fontWeight: 800, fontSize: '58px', lineHeight: 0.92, color: '#fff', letterSpacing: '-0.03em' }}>
                {nombre.toLowerCase()}
              </h1>
              <p style={{ margin: '0 0 22px', color: '#D6DEFF', fontSize: '15.5px', lineHeight: 1.45, maxWidth: '300px' }}>
                Disfruta de nuestra selección de platos. Escanea, elige y disfruta.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setReservaDone(false); setReservaOpen(true) }}
                  style={{ flex: 1, minWidth: '150px', border: 'none', cursor: 'pointer', padding: '15px 18px', borderRadius: '16px', background: '#fff', color: '#15151B', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '15.5px', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}
                >
                  Reservar mesa
                </button>
                <a href="#menu" style={{ flex: 1, minWidth: '130px', textAlign: 'center', textDecoration: 'none', padding: '15px 18px', borderRadius: '16px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 700, fontSize: '15.5px' }}>
                  Ver el menú ↓
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Destacados — solo si hay items con imagen */}
        {destacados.length > 0 && (
          <div style={{ padding: '24px 0 6px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 20px 14px' }}>
              <h2 className="font-bg" style={{ margin: 0, fontWeight: 700, fontSize: '21px', color: '#15151B', letterSpacing: '-0.02em' }}>
                Destacados de la casa
              </h2>
              <span style={{ fontSize: '13px', color: '#FF5A36', fontWeight: 700 }}>★ Top</span>
            </div>
            <div className="hscroll" style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '2px 20px 8px', scrollSnapType: 'x mandatory' }}>
              {destacados.map(item => (
                <div key={item.id} style={{ flex: 'none', width: '208px', scrollSnapAlign: 'start', background: '#fff', borderRadius: '22px', padding: '10px', boxShadow: '0 6px 20px rgba(20,20,26,0.07)' }}>
                  <img src={item.imagen_url!} alt={item.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '16px', display: 'block' }} />
                  <div style={{ padding: '12px 6px 6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '15.5px', color: '#15151B' }}>{item.nombre}</span>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#2C4BFF', whiteSpace: 'nowrap' }}>{item.precio.toFixed(2)} €</span>
                    </div>
                    {item.descripcion && (
                      <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#7A766C', lineHeight: 1.4 }}>{item.descripcion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gate de comensales */}
        {grupoGrande ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '48px' }}>📞</div>
            <p style={{ color: '#15151B', fontSize: '16px', fontWeight: 500, lineHeight: 1.5 }}>
              Para grupos de {max_online_comensales} o más personas, contacta con nosotros directamente.
            </p>
            <button onClick={() => setGrupoGrande(false)} style={{ padding: '10px 24px', borderRadius: '12px', border: '1px solid rgba(20,20,26,0.15)', background: '#fff', color: '#15151B', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Volver
            </button>
          </div>
        ) : !gateConfirmado ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <p className="font-bg" style={{ fontSize: '22px', fontWeight: 700, color: '#15151B', margin: 0 }}>¿Cuántas personas sois?</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <button onClick={() => setGateComensales(n => Math.max(1, n - 1))} disabled={gateComensales <= 1} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(20,20,26,0.15)', background: '#fff', color: '#15151B', fontSize: '20px', fontWeight: 700, cursor: 'pointer', opacity: gateComensales <= 1 ? 0.4 : 1 }}>−</button>
              <span style={{ fontSize: '32px', fontWeight: 700, color: '#15151B', width: '32px', textAlign: 'center' }}>{gateComensales}</span>
              <button onClick={() => setGateComensales(n => n + 1)} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(20,20,26,0.15)', background: '#fff', color: '#15151B', fontSize: '20px', fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>
            <button onClick={handleContinuarGate} style={{ padding: '14px 36px', borderRadius: '16px', border: 'none', background: '#2C4BFF', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}>
              Continuar
            </button>
          </div>
        ) : (
          <>
            {/* Sticky category nav */}
            {carta.length > 1 && (
              <div id="catnav" style={{ position: 'sticky', top: '57px', zIndex: 30, padding: '10px 0', background: 'rgba(246,242,233,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(20,20,26,0.06)' }}>
                <div className="hscroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px' }}>
                  {carta.map(cat => {
                    const active = activeSection === cat.id
                    return (
                      <a key={cat.id} href={`#cat-${cat.id}`} style={{ flex: 'none', textDecoration: 'none', padding: '8px 15px', borderRadius: '999px', background: active ? '#2C4BFF' : '#fff', color: active ? '#fff' : '#454239', fontWeight: 600, fontSize: '13.5px', border: `1px solid ${active ? '#2C4BFF' : 'rgba(20,20,26,0.1)'}`, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                        {cat.nombre}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Secciones del menú */}
            <div id="menu" style={{ padding: '8px 20px 0' }}>
              {carta.map(categoria => (
                <section key={categoria.id} id={`cat-${categoria.id}`} style={{ scrollMarginTop: '112px', padding: '22px 0 6px' }}>
                  {/* Cabecera categoría */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <h3 className="font-bg" style={{ margin: 0, fontWeight: 700, fontSize: '25px', color: '#15151B', letterSpacing: '-0.02em' }}>
                      {categoria.nombre}
                    </h3>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(20,20,26,0.14), transparent)' }} />
                  </div>

                  {/* Items */}
                  {categoria.items.map((item, idx) => {
                    const isLast = idx === categoria.items.length - 1
                    const borderBottom = isLast ? 'none' : '1px solid rgba(20,20,26,0.07)'

                    if (item.imagen_url) {
                      return (
                        <div key={item.id} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 0', borderBottom }}>
                          <img src={item.imagen_url} alt={item.nombre} style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '16px', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '16.5px', color: '#15151B' }}>{item.nombre}</span>
                            {item.descripcion && (
                              <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#7A766C', lineHeight: 1.4 }}>{item.descripcion}</p>
                            )}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '16px', color: '#2C4BFF', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.precio.toFixed(2)} €</span>
                        </div>
                      )
                    }

                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', padding: '15px 0', borderBottom }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '16.5px', color: '#15151B' }}>{item.nombre}</span>
                          {item.descripcion && (
                            <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#7A766C', lineHeight: 1.4 }}>{item.descripcion}</p>
                          )}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '16px', color: '#2C4BFF', whiteSpace: 'nowrap' }}>{item.precio.toFixed(2)} €</span>
                      </div>
                    )
                  })}
                </section>
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: '18px', padding: '30px 24px 36px', background: '#15151B', color: '#fff' }}>
              <h3 className="font-bg" style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '24px', letterSpacing: '-0.02em' }}>¿Te apetece?</h3>
              <p style={{ margin: '0 0 18px', color: '#9B9AA3', fontSize: '14.5px', lineHeight: 1.5 }}>Reserva tu mesa y te guardamos sitio.</p>
              <button
                onClick={() => { setReservaDone(false); setReservaOpen(true) }}
                style={{ width: '100%', border: 'none', cursor: 'pointer', padding: '16px', borderRadius: '16px', background: '#2C4BFF', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '16px' }}
              >
                Reservar mesa
              </button>
            </div>
          </>
        )}
      </div>

      {/* Reservation bottom sheet */}
      {reservaOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setReservaOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,26,0.5)', animation: 'fadeIn 0.2s ease' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '540px', background: '#F6F2E9', borderRadius: '26px 26px 0 0', padding: '22px 22px 28px', animation: 'sheetUp 0.32s cubic-bezier(0.16,1,0.3,1)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ width: '42px', height: '5px', borderRadius: '3px', background: 'rgba(20,20,26,0.15)', margin: '0 auto 18px' }} />

            {!reservaDone ? (
              <div>
                <h3 className="font-bg" style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '24px', color: '#15151B', letterSpacing: '-0.02em' }}>Reservar mesa</h3>
                <p style={{ margin: '0 0 20px', color: '#7A766C', fontSize: '14px' }}>En {nombre.toLowerCase()} · te confirmamos al instante</p>

                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#454239', marginBottom: '8px' }}>¿Cuántos sois?</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
                  {paxOptions.map(v => (
                    <button key={v} onClick={() => setPax(v)} style={{ flex: 1, minWidth: '48px', cursor: 'pointer', padding: '11px 0', borderRadius: '13px', border: `1px solid ${pax === v ? '#2C4BFF' : 'rgba(20,20,26,0.12)'}`, background: pax === v ? '#2C4BFF' : '#fff', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '15px', color: pax === v ? '#fff' : '#15151B' }}>
                      {v}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#454239', marginBottom: '8px' }}>Día</label>
                    <input type="date" value={resvDate} onChange={e => setResvDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '13px', border: '1px solid rgba(20,20,26,0.12)', background: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '14.5px', color: '#15151B' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#454239', marginBottom: '8px' }}>Hora</label>
                    <select value={resvTime} onChange={e => setResvTime(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '13px', border: '1px solid rgba(20,20,26,0.12)', background: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '14.5px', color: '#15151B' }}>
                      {['13:30','14:00','14:30','20:00','20:30','21:00','21:30','22:00'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#454239', marginBottom: '8px' }}>A nombre de</label>
                <input type="text" placeholder="Tu nombre" value={resvName} onChange={e => setResvName(e.target.value)} style={{ width: '100%', padding: '13px', borderRadius: '13px', border: '1px solid rgba(20,20,26,0.12)', background: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '14.5px', color: '#15151B', marginBottom: '22px' }} />

                <button onClick={handleConfirmarReserva} style={{ width: '100%', border: 'none', cursor: 'pointer', padding: '16px', borderRadius: '16px', background: '#2C4BFF', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '16px', boxShadow: '0 8px 20px rgba(44,75,255,0.3)' }}>
                  Confirmar reserva
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '14px 0 8px' }}>
                <div style={{ width: '62px', height: '62px', borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', color: '#fff', fontSize: '30px' }}>✓</div>
                <h3 className="font-bg" style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '23px', color: '#15151B' }}>¡Mesa reservada!</h3>
                <p style={{ margin: '0 0 22px', color: '#7A766C', fontSize: '14.5px', lineHeight: 1.5 }}>{resvDoneMsg}</p>
                <button onClick={() => setReservaOpen(false)} style={{ width: '100%', border: 'none', cursor: 'pointer', padding: '15px', borderRadius: '16px', background: '#15151B', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '15.5px' }}>
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
