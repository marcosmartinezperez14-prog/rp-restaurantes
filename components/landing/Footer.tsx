import { CONTACTO_EMAIL } from '@/lib/config/landing'

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-10 px-4 text-center text-sm">
      <p className="mb-4 font-semibold text-white">RP Restaurantes</p>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
        <a href="/privacidad" className="hover:text-white transition-colors">Política de privacidad</a>
        <a href="/aviso-legal" className="hover:text-white transition-colors">Aviso legal</a>
        <a href="/cookies" className="hover:text-white transition-colors">Política de cookies</a>
      </div>
      <p>{CONTACTO_EMAIL}</p>
      <p className="mt-4 text-xs text-slate-600">© {new Date().getFullYear()} RP Restaurantes. Todos los derechos reservados.</p>
    </footer>
  )
}
