'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WizardProgressProps {
  currentStep: number
  steps: Array<{
    title: string
    description: string
  }>
}

export function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isFuture = stepNumber > currentStep

          return (
            <div key={stepNumber} className="flex items-center flex-1">
              {/* 스텝 원 */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                    isCompleted && 'bg-green-600 border-green-600',
                    isCurrent && 'bg-primary border-primary',
                    isFuture && 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-white" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent && 'text-white',
                        isFuture && 'text-slate-400'
                      )}
                    >
                      {stepNumber}
                    </span>
                  )}
                </div>

                {/* 스텝 라벨 */}
                <div className="mt-3 text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCurrent && 'text-primary font-bold',
                      isCompleted && 'text-green-600',
                      isFuture && 'text-slate-400'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* 연결선 (마지막 스텝 제외) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 transition-all',
                    stepNumber < currentStep ? 'bg-green-600' : 'bg-slate-300'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
