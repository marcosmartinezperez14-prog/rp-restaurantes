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
    <>
      <Hero onCtaClick={() => abrirModal()} />
      <ComoFunciona />
      <Funcionalidades />
      <Pricing onCtaClick={(plan) => abrirModal(plan)} />
      <section className="py-20 px-4 bg-slate-50" id="contacto">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">¿Hablamos?</h2>
          <p className="text-slate-500 text-center mb-10">Solicita una demo gratuita y te lo enseñamos todo sin compromiso.</p>
          <ContactoForm />
        </div>
      </section>
      <Footer />
      <CheckoutModal open={modalOpen} onClose={() => setModalOpen(false)} planSeleccionado={planSeleccionado} />
    </>
  )
}
