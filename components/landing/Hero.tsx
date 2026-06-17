export default function Hero({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="bg-white px-4 pt-24 pb-28 text-center">
      <div className="max-w-3xl mx-auto">
        <p className="text-sm font-medium tracking-widest text-[#B8860B] uppercase mb-8"
           style={{ fontFamily: 'var(--font-inter)' }}>
          Software de gestión para hostelería
        </p>
        <h1
          className="text-4xl md:text-6xl font-semibold leading-tight text-[#1A2B4A] mb-8"
          style={{ fontFamily: 'var(--font-lora)' }}
        >
          Todo lo que necesita tu restaurante,<br className="hidden md:block" /> en un solo lugar
        </h1>
        <p className="text-lg text-gray-500 mb-12 max-w-xl mx-auto leading-relaxed"
           style={{ fontFamily: 'var(--font-inter)' }}>
          TPV, carta digital, reservas y facturación Verifactu integrados.
          Cumple con Hacienda sin esfuerzo y gestiona tu negocio desde cualquier dispositivo.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onCtaClick}
            className="bg-[#1E4080] hover:bg-[#163260] text-white font-semibold px-8 py-4 rounded-lg text-base transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E4080] focus:ring-offset-2"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Ver planes — desde 47€/mes
          </button>
          <a
            href="#contacto"
            className="border border-gray-300 hover:border-gray-500 text-[#1A2B4A] font-semibold px-8 py-4 rounded-lg text-base transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Solicitar demo gratuita
          </a>
        </div>
      </div>
    </section>
  )
}
