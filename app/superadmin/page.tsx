import { getRestaurantes } from '@/app/actions/superadmin'
import SuperadminRestaurantesList from './SuperadminRestaurantesList'

export default async function SuperadminPage() {
  const result = await getRestaurantes()

  if ('error' in result) {
    return (
      <div className="px-6 py-8 text-center text-red-600 text-sm">
        Error: {result.error}
      </div>
    )
  }

  return <SuperadminRestaurantesList datos={result} />
}
