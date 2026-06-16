import CookieBanner from '@/components/cliente/CookieBanner'

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-6 text-center border-t border-gray-100">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-2">
          <a href={`/cliente/${slug}/privacidad`} className="hover:text-gray-700 underline">
            Privacidad
          </a>
          <a href={`/cliente/${slug}/aviso-legal`} className="hover:text-gray-700 underline">
            Aviso legal
          </a>
          <a href={`/cliente/${slug}/cookies`} className="hover:text-gray-700 underline">
            Cookies
          </a>
        </nav>
        <p className="text-xs text-gray-400">Powered by RP Restaurantes</p>
      </footer>
      <CookieBanner slug={slug} />
    </div>
  )
}
