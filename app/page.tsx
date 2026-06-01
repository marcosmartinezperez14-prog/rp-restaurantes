import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>RP Restaurantes</h1>
      <p>Estado de Supabase: Conectado</p>
      <p>Usuario actual: {user ? user.email : 'No hay sesion'}</p>
    </main>
  )
}
