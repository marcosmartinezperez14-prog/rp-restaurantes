import { redirect } from 'next/navigation'
import { getOnboardingData } from '@/app/actions/onboarding'
import OnboardingWizard from './OnboardingWizard'

export default async function OnboardingPage() {
  const data = await getOnboardingData()

  if (data.restaurant.onboarding_completed) {
    redirect('/dashboard')
  }

  return <OnboardingWizard initialData={data} />
}
