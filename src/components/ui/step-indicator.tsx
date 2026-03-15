"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: { label: string }[];
  currentStep: number;
  completedSteps: number[];
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="flex items-start w-full">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div
            key={index}
            className={cn("flex items-start", isLast ? "" : "flex-1")}
          >
            {/* Circle + label column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0",
                  isCompleted && "bg-success text-white",
                  isCurrent &&
                    "bg-accent text-white ring-4 ring-accent/30 animate-pulse",
                  !isCompleted && !isCurrent && "bg-surface-200 text-surface-500"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-xs text-center max-w-[4rem] sm:max-w-[6rem] leading-tight",
                  isCurrent
                    ? "text-accent-600 font-medium"
                    : isCompleted
                      ? "text-success-600"
                      : "text-surface-400"
                )}
              >
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">
                  {step.label.length > 6
                    ? step.label.slice(0, 5) + "..."
                    : step.label}
                </span>
              </span>
            </div>

            {/* Connecting line */}
            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-0.5 mt-4 mx-1",
                  isCompleted ? "bg-success" : "bg-surface-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
