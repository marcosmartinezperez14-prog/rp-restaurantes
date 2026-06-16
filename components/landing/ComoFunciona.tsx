const PASOS = [
  { n: '01', emoji: '📝', titulo: 'Regístrate en 5 minutos', desc: 'Crea tu cuenta, añade tu restaurante y configura el horario. Sin papeleos.' },
  { n: '02', emoji: '🍽️', titulo: 'Configura tu carta y mesas', desc: 'Sube tu menú, crea categorías, asigna mesas y genera el QR para tus clientes.' },
  { n: '03', emoji: '💳', titulo: 'Empieza a cobrar con el TPV', desc: 'Abre comandas, divide cuentas, cobra con tarjeta o efectivo desde cualquier tablet.' },
  { n: '04', emoji: '🧾', titulo: 'Cumple con Hacienda automáticamente', desc: 'Cada ticket genera su registro Verifactu. Sin errores, sin multas, sin estrés.' },
]

export default function ComoFunciona() {
  return (
    <section className="py-20 px-4 bg-white" id="como-funciona">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Cómo funciona</h2>
        <p className="text-slate-500 text-center mb-14">Cuatro pasos para tener tu restaurante digitalizado</p>
        <div className="grid md:grid-cols-2 gap-8">
          {PASOS.map(p => (
            <div key={p.n} className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center text-slate-900 font-bold text-sm">
                {p.n}
              </div>
              <div>
                <div className="text-2xl mb-1">{p.emoji}</div>
                <h3 className="font-bold text-slate-900 mb-1">{p.titulo}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
