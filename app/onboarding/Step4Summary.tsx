'use client'

import { useTransition } from 'react'
import { completeOnboarding, type OnboardingData } from '@/app/actions/onboarding'

interface Props {
  data: OnboardingData
}

export default function Step4Summary({ data }: Props) {
  const [isPending, startTransition] = useTransition()

  const totalTables = data.zones.reduce((sum, z) => sum + z.tables.length, 0)
  const totalProducts = data.categories.reduce((sum, c) => sum + c.products.length, 0)

  const handleComplete = () => {
    startTransition(async () => {
      await completeOnboarding()
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">¡Todo listo!</h2>
        <p className="text-gray-600 text-sm mt-1">
          Aquí tienes un resumen de tu configuración.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <span className="text-green-600 font-bold">✓</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Restaurante</p>
            <p className="text-sm text-gray-600">{data.restaurant.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <span className="text-green-600 font-bold">✓</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Zonas y mesas</p>
            <p className="text-sm text-gray-600">
              {data.zones.length} zona{data.zones.length !== 1 ? 's' : ''} · {totalTables} mesa{totalTables !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <span className="text-green-600 font-bold">✓</span>
          <div>
            <p className="text-sm font-medium text-gray-900">Carta</p>
            <p className="text-sm text-gray-600">
              {data.categories.length} categoría{data.categories.length !== 1 ? 's' : ''} · {totalProducts} producto{totalProducts !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors text-lg"
      >
        {isPending ? 'Configurando...' : 'Empezar a usar el sistema'}
      </button>
    </div>
  )
}
