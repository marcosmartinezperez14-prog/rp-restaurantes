import { redirect } from 'next/navigation'
import { getKitchenItems } from '@/app/actions/cocina'
import CocinaClient from '@/components/cocina/CocinaClient'
import { getRestaurantContext } from '@/lib/auth/restaurant-context'

export default async function CocinaPage() {
  const ctx = await getRestaurantContext()
  if (!ctx) redirect('/login')
  const { restaurantId } = ctx

  const items = await getKitchenItems()

  return (
    <CocinaClient
      initialItems={items}
      restaurantId={restaurantId}
    />
  )
}
