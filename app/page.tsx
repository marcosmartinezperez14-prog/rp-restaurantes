'use client'

import { useState } from 'react'
import Hero from '@/components/landing/Hero'
import ComoFunciona from '@/components/landing/ComoFunciona'
import Funcionalidades from '@/components/landing/Funcionalidades'
import Pricing from '@/components/landing/Pricing'
import ContactoForm from '@/components/landing/ContactoForm'
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
    <div style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Navegación */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span
            className="text-[#1A2B4A] font-semibold text-lg"
            style={{ fontFamily: 'var(--font-lora)' }}
          >
            RP Restaurantes
          </span>
          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-500">
            <a href="#como-funciona" className="hover:text-[#1A2B4A] transition-colors">Cómo funciona</a>
            <a href="#funcionalidades" className="hover:text-[#1A2B4A] transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-[#1A2B4A] transition-colors">Precios</a>
            <a
              href="#contacto"
              className="bg-[#1E4080] hover:bg-[#163260] text-white font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Contacto
            </a>
          </div>
        </div>
      </nav>

      {/* Espacio para la nav fija */}
      <div className="h-16" />

      <Hero onCtaClick={() => abrirModal()} />
      <ComoFunciona />
      <Funcionalidades />
      <Pricing onCtaClick={(plan) => abrirModal(plan)} />

      <section className="py-24 px-4 bg-white" id="contacto">
        <div className="max-w-xl mx-auto">
          <h2
            className="text-3xl md:text-4xl font-semibold text-[#1A2B4A] text-center mb-4"
            style={{ fontFamily: 'var(--font-lora)' }}
          >
            ¿Hablamos?
          </h2>
          <p className="text-gray-500 text-center mb-12 text-base">
            Cuéntanos sobre tu negocio y te explicamos todo sin compromiso.
          </p>
          <ContactoForm />
        </div>
      </section>

      <Footer />
      <CheckoutModal open={modalOpen} onClose={() => setModalOpen(false)} planSeleccionado={planSeleccionado} />
    </div>
  )
}
