import { useState } from 'react';
import { TDRStep } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronRight, Plus } from 'lucide-react';

interface TDRStepsProps {
  steps: TDRStep[];
  onStepClick: (stepId: string) => void;
}

export function TDRSteps({ steps, onStepClick }: TDRStepsProps) {
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  const requiredSteps = steps.filter((s) => s.required !== false);
  const optionalSteps = steps.filter((s) => s.required === false);

  const requiredCompleted = requiredSteps.filter((s) => s.isComplete).length;
  const optionalCompleted = optionalSteps.filter((s) => s.isComplete).length;
  const totalRequired = requiredSteps.length;

  // Progress is based on required steps only
  const progress = Math.round((requiredCompleted / totalRequired) * 100);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/60 p-4">
        <h2 className="text-sm font-medium">TDR Steps</h2>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-2xs text-muted-foreground tabular-nums">
            {requiredCompleted}/{totalRequired}
          </span>
        </div>
        <p className="mt-1 text-2xs text-muted-foreground">Required steps • ~30 min target</p>
      </div>

      {/* Steps list */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Required steps */}
        <ul className="space-y-0.5">
          {requiredSteps.map((step) => (
            <li key={step.id}>
              <button
                onClick={() => onStepClick(step.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                  step.isActive
                    ? 'bg-primary/5 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {step.isComplete ? (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
                      <Check className="h-2.5 w-2.5 text-success-foreground" />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'step-dot',
                        step.isActive && 'step-dot-active'
                      )}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium leading-tight',
                      step.isComplete && 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-2xs text-muted-foreground line-clamp-1">
                    {step.description}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Optional section divider */}
        {optionalSteps.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left rounded-md hover:bg-accent/50 transition-colors"
              onClick={() => setOptionalExpanded(!optionalExpanded)}
            >
              {optionalExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Additional Context
              </span>
              <span className="text-2xs text-muted-foreground/60">optional</span>
              {optionalCompleted > 0 && (
                <span className="ml-auto text-2xs text-emerald-600 tabular-nums">
                  {optionalCompleted}/{optionalSteps.length}
                </span>
              )}
            </button>

            {optionalExpanded && (
              <ul className="mt-0.5 space-y-0.5">
                {optionalSteps.map((step) => (
                  <li key={step.id}>
                    <button
                      onClick={() => onStepClick(step.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        step.isActive
                          ? 'bg-primary/5 text-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                        {step.isComplete ? (
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
                            <Check className="h-2.5 w-2.5 text-success-foreground" />
                          </div>
                        ) : (
                          <Plus className="h-3 w-3 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-xs font-medium leading-tight',
                            step.isComplete
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground/70'
                          )}
                        >
                          {step.title}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
