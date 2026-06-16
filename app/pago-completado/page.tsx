import { CONTACTO_EMAIL } from '@/lib/config/landing'

export default function PagoCompletado() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-10 text-center">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">¡Pago completado!</h1>
        <p className="text-slate-600 leading-relaxed mb-6">
          Hemos recibido tu suscripción. En breve nos pondremos en contacto contigo
          por email o teléfono para activar tu cuenta y ayudarte con la configuración inicial.
        </p>
        <p className="text-sm text-slate-400 mb-8">
          Si tienes cualquier duda, escríbenos a{' '}
          <a href={`mailto:${CONTACTO_EMAIL}`} className="text-amber-500 underline">
            {CONTACTO_EMAIL}
          </a>
        </p>
        <a href="/" className="inline-block bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-8 py-3 rounded-2xl transition-colors">
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
