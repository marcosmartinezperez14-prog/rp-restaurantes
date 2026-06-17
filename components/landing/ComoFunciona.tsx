const PASOS = [
  { n: '01', titulo: 'Regístrate en 5 minutos', desc: 'Crea tu cuenta, añade tu restaurante y configura el horario. Sin papeleos ni instalaciones.' },
  { n: '02', titulo: 'Configura tu carta y tus mesas', desc: 'Sube tu menú, crea categorías, asigna mesas y genera el QR para tus clientes.' },
  { n: '03', titulo: 'Empieza a cobrar con el TPV', desc: 'Abre comandas, divide cuentas y cobra con tarjeta o efectivo desde cualquier tablet.' },
  { n: '04', titulo: 'Cumple con Hacienda automáticamente', desc: 'Cada ticket genera su registro Verifactu. Sin errores, sin multas, sin trabajo extra.' },
]

export default function ComoFunciona() {
  return (
    <section className="py-24 px-4 bg-[#F7F6F3]" id="como-funciona">
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-3xl md:text-4xl font-semibold text-[#1A2B4A] text-center mb-4"
          style={{ fontFamily: 'var(--font-lora)' }}
        >
          Cómo funciona
        </h2>
        <p className="text-gray-500 text-center mb-16 text-base" style={{ fontFamily: 'var(--font-inter)' }}>
          Cuatro pasos para tener tu restaurante digitalizado
        </p>
        <div className="grid md:grid-cols-2 gap-10">
          {PASOS.map(p => (
            <div key={p.n} className="flex gap-6">
              <div className="flex-shrink-0 relative">
                <span
                  className="text-7xl font-semibold text-[#1A2B4A] select-none leading-none"
                  style={{ fontFamily: 'var(--font-lora)', opacity: 0.08 }}
                  aria-hidden="true"
                >
                  {p.n}
                </span>
                <span
                  className="absolute top-1 left-0 text-sm font-semibold text-[#1E4080]"
                  style={{ fontFamily: 'var(--font-inter)' }}
                >
                  {p.n}
                </span>
              </div>
              <div className="pt-1">
                <h3
                  className="font-semibold text-[#1A2B4A] mb-2 text-lg"
                  style={{ fontFamily: 'var(--font-lora)' }}
                >
                  {p.titulo}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed" style={{ fontFamily: 'var(--font-inter)' }}>
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
