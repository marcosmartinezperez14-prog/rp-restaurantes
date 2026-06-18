'use client'

import { useState } from 'react'
import Hero from '@/components/landing/Hero'
import ComoFunciona from '@/components/landing/ComoFunciona'
import Funcionalidades from '@/components/landing/Funcionalidades'
import Pricing from '@/components/landing/Pricing'
import Footer from '@/components/landing/Footer'
import ContactarVentasModal from '@/components/landing/ContactarVentasModal'

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [planSeleccionado, setPlanSeleccionado] = useState<string | undefined>()

  function abrirModal(plan?: string) {
    setPlanSeleccionado(plan)
    setModalOpen(true)
  }

  return (
    <div style={{ fontFamily: 'var(--font-plus-jakarta)', background: '#FFFFFF', color: '#0B1020' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1180, margin: '0 auto', padding: '22px 28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: '#2F54EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 17
          }}>R</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>RP Restaurantes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30, fontSize: 15, fontWeight: 500, color: '#46506A' }}>
          <a href="#funcionalidades" style={{ color: 'inherit', textDecoration: 'none' }}>Funciones</a>
          <a href="#como-funciona" style={{ color: 'inherit', textDecoration: 'none' }}>Cómo funciona</a>
          <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Precios</a>
        </div>
        <button onClick={() => abrirModal()} style={{
          background: '#2F54EB', color: '#fff', border: 'none',
          padding: '11px 20px', borderRadius: 10, fontFamily: 'inherit',
          fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>Contactar ventas</button>
      </nav>

      <Hero onCtaClick={() => abrirModal()} />
      <Funcionalidades />
      <ComoFunciona />
      <Pricing onCtaClick={(plan) => abrirModal(plan)} />

      {/* CTA FINAL */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px 70px' }}>
        <div style={{
          background: '#2F54EB', borderRadius: 26, padding: '64px 40px',
          textAlign: 'center', color: '#fff',
          boxShadow: '0 30px 70px rgba(47,84,235,0.3)'
        }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 14px' }}>
            ¿Listo para ordenar tu servicio?
          </h2>
          <p style={{ fontSize: 18, color: '#D7DEFF', margin: '0 auto 28px', maxWidth: 480 }}>
            Te mostramos RP Restaurantes funcionando con la operativa real de tu local.
          </p>
          <button onClick={() => abrirModal()} style={{
            background: '#fff', color: '#2F54EB', border: 'none',
            padding: '16px 34px', borderRadius: 12, fontFamily: 'inherit',
            fontWeight: 700, fontSize: 16, cursor: 'pointer',
          }}>Contactar ventas</button>
        </div>
      </section>

      <Footer />
      <ContactarVentasModal open={modalOpen} onClose={() => setModalOpen(false)} planSeleccionado={planSeleccionado} />
    </div>
  )
}
