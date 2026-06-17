import { PLANES } from '@/lib/config/landing'

export default function Pricing({ onCtaClick }: { onCtaClick?: (planNombre: string) => void }) {
  return (
    <section className="py-24 px-4 bg-[#F7F6F3]" id="pricing">
      <div className="max-w-5xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-semibold text-[#1A2B4A] text-center mb-4"
          style={{ fontFamily: 'var(--font-lora)' }}
        >
          Elige tu plan
        </h2>
        <p className="text-gray-500 text-center mb-4 text-base" style={{ fontFamily: 'var(--font-inter)' }}>
          Sin permanencia. Cambia o cancela cuando quieras.
        </p>
        <p className="text-center mb-14">
          <span
            className="inline-block border border-[#B8860B] text-[#B8860B] text-sm px-4 py-1.5 rounded"
            style={{ fontFamily: 'var(--font-inter)' }}
          >
            Montaje inicial: precio a consultar (pago único)
          </span>
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANES.map(plan => (
            <div
              key={plan.id}
              className={`bg-white flex flex-col p-8 rounded-lg border-t-4 ${
                plan.destacado
                  ? 'border-t-[#1E4080] shadow-md'
                  : 'border-t-gray-200'
              }`}
            >
              {plan.destacado && (
                <p
                  className="text-xs font-semibold tracking-widest text-[#1E4080] uppercase mb-3"
                  style={{ fontFamily: 'var(--font-inter)' }}
                >
                  Más solicitado
                </p>
              )}
              {!plan.destacado && <div className="mb-6" />}

              <h3
                className="text-xl font-semibold text-[#1A2B4A] mb-2"
                style={{ fontFamily: 'var(--font-lora)' }}
              >
                {plan.nombre}
              </h3>

              <div className="flex items-end gap-1 mb-2">
                <span
                  className="text-4xl font-semibold text-[#1A2B4A]"
                  style={{ fontFamily: 'var(--font-lora)' }}
                >
                  {plan.precio}€
                </span>
                <span className="text-gray-400 mb-1 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
                  /mes
                </span>
              </div>

              <p className="text-sm text-gray-500 mb-8 leading-relaxed" style={{ fontFamily: 'var(--font-inter)' }}>
                {plan.descripcion}
              </p>

              <ul className="space-y-3 mb-10 flex-1">
                {plan.features.map(f => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-sm text-gray-600"
                    style={{ fontFamily: 'var(--font-inter)' }}
                  >
                    <span className="text-[#B8860B] mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onCtaClick?.(plan.nombre)}
                className={`w-full font-semibold py-3 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  plan.destacado
                    ? 'bg-[#1E4080] hover:bg-[#163260] text-white focus:ring-[#1E4080]'
                    : 'bg-white hover:bg-gray-50 text-[#1A2B4A] border border-gray-300 focus:ring-gray-400'
                }`}
                style={{ fontFamily: 'var(--font-inter)' }}
              >
                Solicitar {plan.nombre}
              </button>
            </div>
          ))}
        </div>

        <p
          className="text-xs text-gray-400 text-center mt-10"
          style={{ fontFamily: 'var(--font-inter)' }}
        >
          El precio del montaje inicial se acuerda individualmente según las necesidades de tu negocio.
        </p>
      </div>
    </section>
  )
}
