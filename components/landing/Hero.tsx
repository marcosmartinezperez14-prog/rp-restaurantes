import { PRECIO_MENSUAL } from '@/lib/config/landing'

export default function Hero({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="bg-slate-900 text-white px-4 py-20 text-center">
      <div className="max-w-3xl mx-auto">
        <span className="inline-block bg-amber-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
          TPV · Carta Digital · Verifactu
        </span>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
          El sistema todo en uno<br />para tu restaurante
        </h1>
        <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
          Gestiona tu TPV, carta digital, reservas y facturación electrónica desde
          un solo lugar. Sin complicaciones, sin papel, cumpliendo con Hacienda.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onCtaClick}
            className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-8 py-4 rounded-2xl text-lg transition-colors"
          >
            Empieza ahora — {PRECIO_MENSUAL}€/mes
          </button>
          <a
            href="#contacto"
            className="border border-slate-600 hover:border-slate-400 text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-colors"
          >
            Solicitar demo
          </a>
        </div>
      </div>
    </section>
  )
}
