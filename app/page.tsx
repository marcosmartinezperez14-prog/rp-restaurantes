'use client'

import { useState } from 'react'
import Hero from '@/components/landing/Hero'
import ComoFunciona from '@/components/landing/ComoFunciona'
import Funcionalidades from '@/components/landing/Funcionalidades'
import Pricing from '@/components/landing/Pricing'
import Footer from '@/components/landing/Footer'
import CheckoutModal from '@/components/landing/CheckoutModal'

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [planSeleccionado, setPlanSeleccionado] = useState<string | undefined>()

  function abrirModal(plan?: string) {
    setPlanSeleccionado(plan)
    setModalOpen(true)
  }

  return (
    <div style={{ fontFamily: 'var(--font-plus-jakarta)', background: '#FFFFFF', color: '#0B1020' }}>
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, background: '#2F54EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 17
          }}>R</div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>GestionBar</span>
        </div>
        <div className="landing-nav-links">
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
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 60px' }}>
        <div className="cta-final">
          <h2 className="cta-final-h2">
            ¿Listo para ordenar tu servicio?
          </h2>
          <p style={{ fontSize: 18, color: '#D7DEFF', margin: '0 auto 28px', maxWidth: 480 }}>
            Te mostramos GestionBar funcionando con la operativa real de tu local.
          </p>
          <button onClick={() => abrirModal()} style={{
            background: '#fff', color: '#2F54EB', border: 'none',
            padding: '16px 34px', borderRadius: 12, fontFamily: 'inherit',
            fontWeight: 700, fontSize: 16, cursor: 'pointer',
          }}>Contactar ventas</button>
        </div>
      </section>

      <Footer />
      <CheckoutModal open={modalOpen} onClose={() => setModalOpen(false)} planSeleccionado={planSeleccionado} />

      <style>{`
        .landing-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1180px;
          margin: 0 auto;
          padding: 22px 28px;
        }
        .landing-nav-links {
          display: flex;
          align-items: center;
          gap: 30px;
          font-size: 15px;
          font-weight: 500;
          color: #46506A;
        }
        .cta-final {
          background: #2F54EB;
          border-radius: 26px;
          padding: 64px 40px;
          text-align: center;
          color: #fff;
          box-shadow: 0 30px 70px rgba(47,84,235,0.3);
        }
        .cta-final-h2 {
          font-size: 40px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0 0 14px;
        }
        @media (max-width: 768px) {
          .landing-nav { padding: 18px 20px; }
          .landing-nav-links { display: none; }
          .cta-final { padding: 40px 24px; border-radius: 18px; }
          .cta-final-h2 { font-size: 26px; }
        }
      `}</style>
    </div>
  )
}
