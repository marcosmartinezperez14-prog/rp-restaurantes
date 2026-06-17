import { PLANES } from '@/lib/config/landing'

export default function Pricing({ onCtaClick }: { onCtaClick?: (planNombre: string) => void }) {
  return (
    <section className="py-20 px-4 bg-white" id="pricing">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Elige tu plan</h2>
        <p className="text-slate-500 text-center mb-4">Sin permanencia. Cambia o cancela cuando quieras.</p>
        <p className="text-center mb-12">
          <span className="inline-block bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-full">
            Montaje inicial: precio a consultar (pago único)
          </span>
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANES.map(plan => (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-8 flex flex-col ${
                plan.destacado
                  ? 'border-2 border-amber-400 shadow-xl'
                  : 'border border-slate-200 shadow-sm'
              }`}
            >
              {plan.destacado && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                  Más popular
                </span>
              )}

              <p className={`text-sm font-bold uppercase tracking-wide mb-2 ${plan.destacado ? 'text-amber-500' : 'text-slate-400'}`}>
                {plan.nombre}
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold text-slate-900">{plan.precio}€</span>
                <span className="text-slate-500 mb-1">/mes</span>
              </div>
              <p className="text-sm text-slate-500 mb-6">{plan.descripcion}</p>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-amber-400 font-bold mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onCtaClick?.(plan.nombre)}
                className={`w-full font-bold py-3 rounded-2xl text-base transition-colors ${
                  plan.destacado
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-900'
                    : 'bg-slate-900 hover:bg-slate-700 text-white'
                }`}
              >
                Contratar {plan.nombre}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center mt-8">
          El precio del montaje inicial se acuerda individualmente según las necesidades de tu negocio.
        </p>
      </div>
    </section>
  )
}
