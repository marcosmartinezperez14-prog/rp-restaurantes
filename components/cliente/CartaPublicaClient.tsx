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
  const [gateConfirmado, setGateConfirmado] = useState(max_online_comensales === null)
  const [comensales, setComensales] = useState(1)
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
    if (max_online_comensales !== null && comensales >= max_online_comensales) {
      setGrupoGrande(true)
    } else {
      setGateConfirmado(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EFE9DC', display: 'flex', justifyContent: 'center', padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap');
        .hscroll::-webkit-scrollbar { display: none; }
        .hscroll { scrollbar-width: none; }
        .carta-body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
        .font-bricolage { font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
        .item-row:last-child { border-bottom: none !important; }
      `}</style>

      <div className="carta-body" style={{ width: '100%', maxWidth: '540px', background: '#F6F2E9', position: 'relative', boxShadow: '0 0 60px rgba(20,20,26,0.08)' }}>

        {/* App bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(246,242,233,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(20,20,26,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div className="font-bricolage" style={{ width: '26px', height: '26px', borderRadius: '8px', background: '#2C4BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '15px' }}>
              {logoLetra}
            </div>
            <span className="font-bricolage" style={{ fontWeight: 700, fontSize: '17px', color: '#15151B', letterSpacing: '-0.01em' }}>
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
              <h1 className="font-bricolage" style={{ margin: '16px 0 6px', fontWeight: 800, fontSize: 'clamp(40px,10vw,58px)', lineHeight: 0.92, color: '#fff', letterSpacing: '-0.03em' }}>
                {nombre}
              </h1>
              <p style={{ margin: '0 0 22px', color: '#D6DEFF', fontSize: '15.5px', lineHeight: 1.45, maxWidth: '300px' }}>
                Disfruta de nuestra selección de platos. Escanea, elige y disfruta.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link
                  href={`/cliente/${slug}/reservas`}
                  style={{ flex: 1, minWidth: '150px', display: 'block', textAlign: 'center', textDecoration: 'none', padding: '15px 18px', borderRadius: '16px', background: '#fff', color: '#15151B', fontWeight: 700, fontSize: '15.5px', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}
                >
                  Reservar mesa
                </Link>
                <a
                  href="#menu"
                  style={{ flex: 1, minWidth: '130px', textAlign: 'center', textDecoration: 'none', padding: '15px 18px', borderRadius: '16px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 700, fontSize: '15.5px' }}
                >
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
              <h2 className="font-bricolage" style={{ margin: 0, fontWeight: 700, fontSize: '21px', color: '#15151B', letterSpacing: '-0.02em' }}>
                Destacados de la casa
              </h2>
              <span style={{ fontSize: '13px', color: '#FF5A36', fontWeight: 700 }}>★ Top</span>
            </div>
            <div className="hscroll" style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '2px 20px 8px', scrollSnapType: 'x mandatory' }}>
              {destacados.map(item => (
                <div key={item.id} style={{ flex: 'none', width: '208px', scrollSnapAlign: 'start', background: '#fff', borderRadius: '22px', padding: '10px', boxShadow: '0 6px 20px rgba(20,20,26,0.07)' }}>
                  <img
                    src={item.imagen_url!}
                    alt={item.nombre}
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '16px', display: 'block' }}
                  />
                  <div style={{ padding: '12px 6px 6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '15.5px', color: '#15151B' }}>{item.nombre}</span>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#2C4BFF', whiteSpace: 'nowrap' }}>{item.precio.toFixed(2)} €</span>
                    </div>
                    {item.descripcion && (
                      <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#7A766C', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.descripcion}
                      </p>
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
              Para grupos de {max_online_comensales} o más personas, contacta con nosotros por teléfono.
            </p>
            <button
              onClick={() => setGrupoGrande(false)}
              style={{ padding: '10px 24px', borderRadius: '12px', border: '1px solid rgba(20,20,26,0.15)', background: '#fff', color: '#15151B', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Volver
            </button>
          </div>
        ) : !gateConfirmado ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <p className="font-bricolage" style={{ fontSize: '22px', fontWeight: 700, color: '#15151B', margin: 0 }}>¿Cuántas personas sois?</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <button
                onClick={() => setComensales(n => Math.max(1, n - 1))}
                disabled={comensales <= 1}
                style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(20,20,26,0.15)', background: '#fff', color: '#15151B', fontSize: '20px', fontWeight: 700, cursor: 'pointer', opacity: comensales <= 1 ? 0.4 : 1 }}
              >−</button>
              <span style={{ fontSize: '32px', fontWeight: 700, color: '#15151B', width: '32px', textAlign: 'center' }}>{comensales}</span>
              <button
                onClick={() => setComensales(n => n + 1)}
                style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid rgba(20,20,26,0.15)', background: '#fff', color: '#15151B', fontSize: '20px', fontWeight: 700, cursor: 'pointer' }}
              >+</button>
            </div>
            <button
              onClick={handleContinuarGate}
              style={{ padding: '14px 36px', borderRadius: '16px', border: 'none', background: '#2C4BFF', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
            >
              Continuar
            </button>
          </div>
        ) : (
          <>
            {/* Sticky category nav */}
            {carta.length > 1 && (
              <div id="menu" style={{ position: 'sticky', top: '57px', zIndex: 30, padding: '10px 0', background: 'rgba(246,242,233,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(20,20,26,0.06)' }}>
                <div className="hscroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px' }}>
                  {carta.map(cat => {
                    const active = activeSection === cat.id
                    return (
                      <a
                        key={cat.id}
                        href={`#cat-${cat.id}`}
                        style={{
                          flex: 'none',
                          textDecoration: 'none',
                          padding: '8px 15px',
                          borderRadius: '999px',
                          background: active ? '#2C4BFF' : '#fff',
                          color: active ? '#fff' : '#454239',
                          fontWeight: 600,
                          fontSize: '13.5px',
                          border: `1px solid ${active ? '#2C4BFF' : 'rgba(20,20,26,0.1)'}`,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cat.nombre}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Secciones del menú */}
            <div id={carta.length === 1 ? 'menu' : undefined} style={{ padding: '8px 20px 0' }}>
              {carta.map(categoria => (
                <section key={categoria.id} id={`cat-${categoria.id}`} style={{ scrollMarginTop: '112px', padding: '22px 0 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                    <h3 className="font-bricolage" style={{ margin: 0, fontWeight: 700, fontSize: '25px', color: '#15151B', letterSpacing: '-0.02em' }}>
                      {categoria.nombre}
                    </h3>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(20,20,26,0.14), transparent)' }} />
                  </div>

                  {categoria.items.map(item => (
                    <div key={item.id} className="item-row" style={{ display: 'flex', gap: '14px', alignItems: item.imagen_url ? 'center' : 'flex-start', padding: '15px 0', borderBottom: '1px solid rgba(20,20,26,0.07)' }}>
                      {item.imagen_url && (
                        <img
                          src={item.imagen_url}
                          alt={item.nombre}
                          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '14px', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: '16.5px', color: '#15151B' }}>{item.nombre}</span>
                        {item.descripcion && (
                          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#7A766C', lineHeight: 1.4 }}>{item.descripcion}</p>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '16px', color: '#2C4BFF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {item.precio.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </section>
              ))}
            </div>

            {/* Footer de la carta */}
            <div style={{ marginTop: '18px', padding: '30px 24px 36px', background: '#15151B', color: '#fff' }}>
              <h3 className="font-bricolage" style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '24px', letterSpacing: '-0.02em' }}>¿Te apetece?</h3>
              <p style={{ margin: '0 0 18px', color: '#9B9AA3', fontSize: '14.5px', lineHeight: 1.5 }}>Reserva tu mesa y te guardamos sitio.</p>
              <Link
                href={`/cliente/${slug}/reservas`}
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none', width: '100%', padding: '16px', borderRadius: '16px', background: '#2C4BFF', color: '#fff', fontWeight: 700, fontSize: '16px' }}
              >
                Reservar mesa
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
