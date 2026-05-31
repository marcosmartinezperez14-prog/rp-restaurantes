'use client'

import { useState } from 'react'
import type { OnboardingData, ZoneInput, CategoryInput } from '@/app/actions/onboarding'
import Step1RestaurantData from './Step1RestaurantData'
import Step2ZonesAndTables from './Step2ZonesAndTables'
import Step3Menu from './Step3Menu'
import Step4Summary from './Step4Summary'

interface Props {
  initialData: OnboardingData
}

const STEP_NAMES = ['Restaurante', 'Zonas', 'Carta', '¡Listo!']

export default function OnboardingWizard({ initialData }: Props) {
  const [step, setStep] = useState(
    Math.min(Math.max(initialData.restaurant.onboarding_step, 1), 4)
  )
  const [data, setData] = useState<OnboardingData>(initialData)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <p className="text-center text-sm text-gray-500 mb-6">RP Restaurantes</p>

        <div className="flex items-center justify-center mb-8">
          {STEP_NAMES.map((name, i) => {
            const stepNum = i + 1
            const isActive = stepNum === step
            const isCompleted = stepNum < step
            return (
              <div key={stepNum} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive || isCompleted
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {isCompleted ? '✓' : stepNum}
                  </div>
                  <span
                    className={`text-xs mt-1 whitespace-nowrap ${
                      isActive ? 'text-blue-600 font-medium' : 'text-gray-500'
                    }`}
                  >
                    {name}
                  </span>
                </div>
                {i < STEP_NAMES.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mb-5 mx-1 ${
                      stepNum < step ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          {step === 1 && (
            <Step1RestaurantData
              restaurant={data.restaurant}
              onNext={(updated) => {
                setData(d => ({
                  ...d,
                  restaurant: { ...d.restaurant, ...updated, onboarding_step: 2 },
                }))
                setStep(2)
              }}
            />
          )}
          {step === 2 && (
            <Step2ZonesAndTables
              zones={data.zones}
              onNext={(zones: ZoneInput[]) => {
                setData(d => ({ ...d, zones }))
                setStep(3)
              }}
            />
          )}
          {step === 3 && (
            <Step3Menu
              categories={data.categories}
              onNext={(categories: CategoryInput[]) => {
                setData(d => ({ ...d, categories }))
                setStep(4)
              }}
            />
          )}
          {step === 4 && <Step4Summary data={data} />}
        </div>
      </div>
    </div>
  )
}
