'use client'

import { useState, useTransition } from 'react'
import { saveRestaurantData } from '@/app/actions/onboarding'

interface Props {
  restaurant: {
    name: string
    address: string | null
    phone: string | null
    schedule: string | null
  }
  onNext: (updated: {
    name: string
    address: string
    phone: string
    schedule: string
  }) => void
}

export default function Step1RestaurantData({ restaurant, onNext }: Props) {
  const [name, setName] = useState(restaurant.name)
  const [address, setAddress] = useState(restaurant.address ?? '')
  const [phone, setPhone] = useState(restaurant.phone ?? '')
  const [schedule, setSchedule] = useState(restaurant.schedule ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('El nombre del restaurante es obligatorio.')
      return
    }
    startTransition(async () => {
      const result = await saveRestaurantData({
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        schedule: schedule.trim(),
      })
      if (result?.error) {
        setError(result.error)
      } else {
        onNext({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          schedule: schedule.trim(),
        })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Datos del restaurante</h2>

      <div>
        <label htmlFor="ob-name" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del restaurante
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="ob-address" className="block text-sm font-medium text-gray-700 mb-1">
          Dirección
        </label>
        <input
          id="ob-address"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Calle Mayor 1, Madrid"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="ob-phone" className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <input
          id="ob-phone"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="91 123 45 67"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label htmlFor="ob-schedule" className="block text-sm font-medium text-gray-700 mb-1">
          Horario
        </label>
        <input
          id="ob-schedule"
          value={schedule}
          onChange={e => setSchedule(e.target.value)}
          placeholder="Lun-Vie 12:00-23:00"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Guardando...' : 'Guardar y continuar →'}
      </button>
    </form>
  )
}
