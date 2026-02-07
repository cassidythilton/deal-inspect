import { TDRStep } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TDRStepsProps {
  steps: TDRStep[];
  onStepClick: (stepId: string) => void;
}

export function TDRSteps({ steps, onStepClick }: TDRStepsProps) {
  const completedCount = steps.filter((s) => s.isComplete).length;
  const progress = Math.round((completedCount / steps.length) * 100);

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
            {completedCount}/{steps.length}
          </span>
        </div>
      </div>

      {/* Steps list */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {steps.map((step, index) => (
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
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
