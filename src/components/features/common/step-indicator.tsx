import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={index}
              className={cn(
                "flex flex-col items-center",
                !isLast && "flex-1"
              )}
            >
              <div className="flex items-center w-full">
                {/* 스텝 원형 */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    "text-sm font-semibold transition-colors",
                    isCompleted &&
                      "bg-green-500 text-white dark:bg-green-600",
                    isCurrent &&
                      "bg-blue-500 text-white dark:bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900",
                    isFuture &&
                      "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* 연결선 (마지막 스텝 제외) */}
                {!isLast && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-1 transition-colors",
                      isCompleted
                        ? "bg-green-500 dark:bg-green-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    )}
                  />
                )}
              </div>

              {/* 라벨 + 설명 */}
              <div
                className={cn(
                  "mt-2 text-center",
                  !isLast && "pr-2"
                )}
              >
                <p
                  className={cn(
                    "text-xs font-medium leading-tight",
                    isCompleted &&
                      "text-green-600 dark:text-green-400",
                    isCurrent &&
                      "text-blue-600 dark:text-blue-400",
                    isFuture &&
                      "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-tight",
                      isCompleted &&
                        "text-green-500 dark:text-green-500",
                      isCurrent &&
                        "text-blue-400 dark:text-blue-500",
                      isFuture &&
                        "text-slate-300 dark:text-slate-600"
                    )}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
