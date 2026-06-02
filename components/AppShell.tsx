import NavDrawer from './NavDrawer'

export default function AppShell({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col">
      <header className="bg-white border-b border-[#e2e8f0] px-4 h-[52px] flex items-center gap-3 flex-shrink-0 shadow-sm">
        <NavDrawer />
        <h1 className="text-[15px] font-semibold text-[#0f172a]">{title}</h1>
      </header>
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
