'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { CategoriaCarta, ItemCarta } from '@/app/api/cliente/[slug]/carta/route'
import type { ItemConModificadores, ModifierSnapshot } from '@/types/modificadores'
import SelectorModificadores from '@/components/shared/SelectorModificadores'

type ItemCarrito = {
  key: string
  id: string
  nombre: string
  precio: number
  cantidad: number
  cantidad_minima: number
  modifiers_snapshot: ModifierSnapshot[]
  nota?: string
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
  .navpill { transition: color 0.15s; }
  .add-btn:active { transform: scale(0.88); }
  .qty-btn:active { transform: scale(0.92); }
`

export default function MesaPage() {
  const params = useParams()
  const slug = params.slug as string
  const mesaId = params.mesa_id as string

  const [restaurante, setRestaurante] = useState<{ nombre: string } | null>(null)
  const [mesa, setMesa] = useState<{ id: string; nombre: string } | null>(null)
  const [carta, setCarta] = useState<CategoriaCarta[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [selectorItem, setSelectorItem] = useState<ItemCarta | null>(null)
  const [carritoOpen, setCarritoOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    fetch(`/api/cliente/${slug}/mesa/${mesaId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setRestaurante(data.restaurante)
        setMesa(data.mesa)
        setCarta(data.carta)
        setActiveSection(data.carta[0]?.id ?? '')
      })
      .catch(() => setError('No se pudo cargar la carta'))
      .finally(() => setCargando(false))
  }, [slug, mesaId])

  useEffect(() => {
    if (!carta.length) return
    const ids = carta.map(c => c.id)
    const handleScroll = () => {
      let cur = ids[0] ?? ''
      for (const id of ids) {
        const el = document.getElementById(`cat-${id}`)
        if (el && el.getBoundingClientRect().top <= 120) cur = id
      }
      setActiveSection(cur)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [carta])

  function handleAñadir(item: ItemCarta) {
    setSelectorItem(item)
  }

  function handleSelectorConfirmar(resultado: ItemConModificadores) {
    setSelectorItem(null)
    const itemCarta = carta.flatMap(c => c.items).find(i => i.id === resultado.menu_item_id)
    if (!itemCarta) return
    const key = `${resultado.menu_item_id}:${JSON.stringify(resultado.modifiers_snapshot)}`
    setCarrito(prev => {
      const existe = prev.find(i => i.key === key)
      if (existe) return prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad + resultado.cantidad } : i)
      return [...prev, {
        key,
        id: resultado.menu_item_id,
        nombre: itemCarta.nombre,
        precio: resultado.precio_final,
        cantidad: resultado.cantidad,
        cantidad_minima: itemCarta.cantidad_minima,
        modifiers_snapshot: resultado.modifiers_snapshot,
        nota: resultado.nota,
      }]
    })
  }

  function sumar(key: string) {
    setCarrito(prev => prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i))
  }

  function restar(key: string) {
    setCarrito(prev => {
      const item = prev.find(i => i.key === key)
      if (!item) return prev
      if (item.cantidad <= item.cantidad_minima) return prev.filter(i => i.key !== key)
      return prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  function cantidadEnCarrito(itemId: string): number {
    return carrito.filter(i => i.id === itemId).reduce((sum, i) => sum + i.cantidad, 0)
  }

  const totalCarrito = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
  const totalItems = carrito.reduce((sum, i) => sum + i.cantidad, 0)
  const nombreRestaurante = restaurante?.nombre ?? ''

  async function handleEnviarPedido() {
    setErrorEnvio(null)
    const itemBajominimo = carrito.find(i => i.cantidad < i.cantidad_minima)
    if (itemBajominimo) {
      setErrorEnvio(`"${itemBajominimo.nombre}" tiene un mínimo de ${itemBajominimo.cantidad_minima} unidad(es).`)
      return
    }
    setEnviando(true)
    try {
      const res = await fetch(`/api/cliente/${slug}/mesa/${mesaId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: carrito.map(i => ({
            menu_item_id: i.id,
            nombre: i.nombre,
            precio: i.precio,
            cantidad: i.cantidad,
            modifiers_snapshot: i.modifiers_snapshot,
            nota: i.nota ?? null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorEnvio(data.error ?? 'No se pudo enviar el pedido'); return }
      setCarritoOpen(false)
      setPedidoEnviado(true)
      setCarrito([])
    } catch {
      setErrorEnvio('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#EDEAE3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{FONTS}</style>
        <p style={{ color: '#AFA89A', fontSize: '13px', fontFamily: "'Jost', system-ui, sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>Cargando carta…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#EDEAE3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <style>{FONTS}</style>
        <p style={{ color: '#9E4F2E', fontSize: '14px', textAlign: 'center', fontFamily: "'Jost', system-ui, sans-serif" }}>{error}</p>
      </div>
    )
  }

  if (pedidoEnviado) {
    return (
      <div style={{ minHeight: '100vh', background: '#EDEAE3', display: 'flex', justifyContent: 'center' }}>
        <style>{FONTS}</style>
        <div style={{ width: '100%', maxWidth: '540px', background: '#F8F6F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '1px solid #9E4F2E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', color: '#9E4F2E', fontSize: '22px' }}>✓</div>
          <h2 style={{ margin: '0 0 12px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '34px', color: '#211E1A', letterSpacing: '0.01em' }}>Pedido enviado</h2>
          <p style={{ margin: '0 0 40px', color: '#837C70', fontSize: '14px', fontWeight: 300, lineHeight: 1.7, maxWidth: '280px' }}>El equipo ya está preparando tu pedido. En breve llegará a tu mesa.</p>
          <button
            onClick={() => setPedidoEnviado(false)}
            style={{ border: 'none', cursor: 'pointer', padding: '13px 32px', background: 'none', color: '#211E1A', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderBottom: '1px solid #211E1A' }}
          >
            Pedir más
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EDEAE3', display: 'flex', justifyContent: 'center' }}>
      <style>{FONTS}</style>

      <div style={{ width: '100%', maxWidth: '540px', background: '#F8F6F0', position: 'relative', overflow: 'hidden' }}>

        {/* App bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', background: 'rgba(248,246,240,0.88)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '21px', color: '#211E1A', letterSpacing: '0.04em' }}>{nombreRestaurante}</span>
          <span style={{ fontSize: '11px', fontWeight: 400, color: '#AFA89A', letterSpacing: '0.08em' }}>{mesa?.nombre}</span>
        </div>

        {/* Hero */}
        <div style={{ padding: '64px 32px 56px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 24px', fontSize: '10.5px', fontWeight: 400, letterSpacing: '0.4em', textTransform: 'uppercase', color: '#9E4F2E' }}>Carta · Mesa {mesa?.nombre}</p>
          <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '72px', lineHeight: 0.95, color: '#211E1A', letterSpacing: '0.01em' }}>{nombreRestaurante}</h1>
          <p style={{ margin: '26px auto 0', maxWidth: '300px', fontSize: '14px', fontWeight: 300, lineHeight: 1.7, color: '#837C70' }}>Elige lo que más te apetezca y enviamos el pedido a cocina.</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '38px' }}>
            <a href="#menu" style={{ cursor: 'pointer', padding: '13px 28px', background: 'none', color: '#AFA89A', textDecoration: 'none', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', borderBottom: '1px solid transparent' }}>Ver la carta ↓</a>
          </div>
        </div>

        {/* Sticky category nav */}
        {carta.length > 1 && (
          <div style={{ position: 'sticky', top: '62px', zIndex: 30, padding: '15px 0', background: 'rgba(248,246,240,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(33,30,26,0.06)' }}>
            <div className="hscroll" style={{ display: 'flex', gap: '28px', overflowX: 'auto', padding: '0 32px' }}>
              {carta.map((cat, idx) => {
                const active = activeSection === cat.id
                return (
                  <a
                    key={cat.id}
                    href={`#cat-${cat.id}`}
                    className="navpill"
                    data-sec={idx}
                    style={{ flex: 'none', textDecoration: 'none', color: active ? '#211E1A' : '#AFA89A', fontWeight: 400, fontSize: '11.5px', letterSpacing: '0.16em', textTransform: 'uppercase' }}
                  >
                    {cat.nombre}
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Menu */}
        <div id="menu" style={{ padding: '14px 32px 0' }}>
          {carta.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#AFA89A', padding: '64px 0', fontSize: '14px', fontWeight: 300, letterSpacing: '0.08em' }}>La carta no está disponible.</p>
          ) : carta.map(categoria => (
            <section key={categoria.id} id={`cat-${categoria.id}`} style={{ scrollMarginTop: '120px', padding: '40px 0 10px' }}>
              <h3 style={{ margin: '0 0 22px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '15px', fontStyle: 'italic', color: '#9E4F2E', letterSpacing: '0.02em' }}>{categoria.nombre}</h3>

              {categoria.items.map((item, idx) => {
                const isLast = idx === categoria.items.length - 1
                const cantidad = cantidadEnCarrito(item.id)

                const controls = cantidad > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <button className="qty-btn" onClick={() => {
                      const lastKey = [...carrito].reverse().find(i => i.id === item.id)?.key
                      if (lastKey) restar(lastKey)
                    }} style={{ width: '26px', height: '26px', border: '1px solid rgba(33,30,26,0.2)', background: 'none', color: '#211E1A', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 0 }}>−</button>
                    <span style={{ fontSize: '14px', fontWeight: 400, color: '#9E4F2E', minWidth: '14px', textAlign: 'center' }}>{cantidad}</span>
                    <button className="add-btn" onClick={() => handleAñadir(item)} style={{ width: '26px', height: '26px', border: 'none', background: '#211E1A', color: '#F8F6F0', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 0 }}>+</button>
                  </div>
                ) : (
                  <button className="add-btn" onClick={() => handleAñadir(item)} style={{ width: '26px', height: '26px', border: '1px solid rgba(33,30,26,0.2)', background: 'none', color: '#211E1A', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 0 }}>+</button>
                )

                return (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-start', padding: '14px 0', borderBottom: isLast ? 'none' : '1px solid rgba(33,30,26,0.07)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.imagen_url && (
                        <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block', marginBottom: '12px' }} />
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '20px', color: '#211E1A' }}>{item.nombre}</span>
                        <span style={{ fontWeight: 300, fontSize: '15px', color: '#211E1A', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.precio.toFixed(2)} €</span>
                      </div>
                      {item.descripcion && (
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', fontWeight: 300, color: '#837C70', lineHeight: 1.5 }}>{item.descripcion}</p>
                      )}
                    </div>
                    <div style={{ paddingTop: '4px', flexShrink: 0 }}>{controls}</div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '36px', padding: '56px 32px 60px', textAlign: 'center', borderTop: '1px solid rgba(33,30,26,0.1)' }}>
          <p style={{ margin: '0 auto', maxWidth: '280px', color: '#AFA89A', fontSize: '13px', fontWeight: 300, lineHeight: 1.7, letterSpacing: '0.02em' }}>Llama al camarero si necesitas ayuda.</p>
        </div>

        {/* Espaciado para el pill flotante */}
        {carrito.length > 0 && <div style={{ height: '90px' }} />}

        {/* Pill flotante "Ver pedido" */}
        {carrito.length > 0 && (
          <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, width: '100%', maxWidth: '500px', padding: '0 28px' }}>
            <button
              onClick={() => setCarritoOpen(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', border: 'none', background: '#211E1A', color: '#F8F6F0', fontFamily: "'Jost', sans-serif", cursor: 'pointer', borderRadius: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '22px', height: '22px', border: '1px solid rgba(248,246,240,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 400 }}>{totalItems}</span>
                <span style={{ fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>Ver pedido</span>
              </div>
              <span style={{ fontWeight: 300, fontSize: '15px' }}>{totalCarrito.toFixed(2)} €</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom sheet carrito */}
      {carritoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setCarritoOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.45)', animation: 'fadeIn 0.2s ease' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '540px', background: '#F8F6F0', padding: '34px 32px 38px', animation: 'sheetUp 0.32s cubic-bezier(0.16,1,0.3,1)', maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ width: '36px', height: '2px', background: 'rgba(33,30,26,0.2)', margin: '0 auto 30px' }} />
            <h3 style={{ margin: '0 0 28px', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: '30px', color: '#211E1A', textAlign: 'center' }}>Tu pedido</h3>

            {carrito.map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 0', borderBottom: '1px solid rgba(33,30,26,0.07)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '18px', color: '#211E1A' }}>{item.nombre}</p>
                  {item.modifiers_snapshot.length > 0 && (
                    <p style={{ margin: '3px 0 0', fontSize: '12px', fontWeight: 300, color: '#837C70' }}>{item.modifiers_snapshot.map(m => m.option_name).join(' · ')}</p>
                  )}
                  {item.nota && (
                    <p style={{ margin: '2px 0 0', fontSize: '11.5px', fontWeight: 300, color: '#AFA89A', fontStyle: 'italic' }}>{item.nota}</p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, paddingTop: '2px' }}>
                  <button className="qty-btn" onClick={() => restar(item.key)} style={{ width: '26px', height: '26px', border: '1px solid rgba(33,30,26,0.2)', background: 'none', color: '#211E1A', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>−</button>
                  <span style={{ fontSize: '14px', fontWeight: 400, color: '#211E1A', minWidth: '16px', textAlign: 'center' }}>{item.cantidad}</span>
                  <button className="qty-btn" onClick={() => sumar(item.key)} style={{ width: '26px', height: '26px', border: '1px solid rgba(33,30,26,0.2)', background: 'none', color: '#211E1A', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>+</button>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 300, color: '#211E1A', minWidth: '52px', textAlign: 'right', paddingTop: '4px', flexShrink: 0 }}>{(item.precio * item.cantidad).toFixed(2)} €</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '22px 0 28px', paddingTop: '18px', borderTop: '1px solid rgba(33,30,26,0.1)' }}>
              <span style={{ fontSize: '11px', fontWeight: 400, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#AFA89A' }}>Total</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, fontSize: '28px', color: '#211E1A' }}>{totalCarrito.toFixed(2)} €</span>
            </div>

            {errorEnvio && (
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9E4F2E', textAlign: 'center', fontWeight: 300 }}>{errorEnvio}</p>
            )}

            <button
              onClick={handleEnviarPedido}
              disabled={enviando}
              style={{ width: '100%', border: 'none', cursor: enviando ? 'default' : 'pointer', padding: '16px', background: enviando ? '#837C70' : '#211E1A', color: '#F8F6F0', fontFamily: "'Jost', sans-serif", fontWeight: 400, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', transition: 'background 0.15s', borderRadius: 0 }}
            >
              {enviando ? 'Enviando…' : 'Enviar pedido a cocina'}
            </button>
          </div>
        </div>
      )}

      {/* Selector de modificadores */}
      {selectorItem && (
        <SelectorModificadores
          menuItem={{ id: selectorItem.id, name: selectorItem.nombre, price: selectorItem.precio }}
          cantidadMinima={selectorItem.cantidad_minima}
          onConfirmar={handleSelectorConfirmar}
          onCancelar={() => setSelectorItem(null)}
        />
      )}
    </div>
  )
}
