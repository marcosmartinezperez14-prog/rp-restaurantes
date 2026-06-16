import { PLAN_NOMBRE, PRECIO_MENSUAL } from '@/lib/config/landing'

const INCLUIDO = [
  'TPV táctil ilimitado',
  'Carta digital con QR',
  'Gestión de reservas con RGPD',
  'Facturación Verifactu automática',
  'Informes y cierre de caja',
  'Soporte por WhatsApp y email',
  'Sin permanencia — cancela cuando quieras',
]

export default function Pricing({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="py-20 px-4 bg-white" id="pricing">
      <div className="max-w-md mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Precio sencillo, sin sorpresas</h2>
        <p className="text-slate-500 text-center mb-12">Un solo plan. Todo incluido.</p>
        <div className="border-2 border-amber-400 rounded-3xl p-8 shadow-lg">
          <p className="text-sm font-bold text-amber-500 uppercase tracking-wide mb-2">{PLAN_NOMBRE}</p>
          <div className="flex items-end gap-1 mb-6">
            <span className="text-5xl font-bold text-slate-900">{PRECIO_MENSUAL}€</span>
            <span className="text-slate-500 mb-2">/mes</span>
          </div>
          <ul className="space-y-3 mb-8">
            {INCLUIDO.map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-400 font-bold mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={onCtaClick}
            className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-4 rounded-2xl text-lg transition-colors"
          >
            Empieza ahora
          </button>
          <p className="text-xs text-slate-400 text-center mt-4">Pago mensual por tarjeta. Cancela en cualquier momento.</p>
        </div>
      </div>
    </section>
  )
}
