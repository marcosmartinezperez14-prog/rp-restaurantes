export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        Powered by RP Restaurantes
      </footer>
    </div>
  )
}
