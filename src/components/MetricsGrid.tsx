import { MetricCard as MetricCardType } from '@/types/tdr';
import { cn } from '@/lib/utils';

interface StatCardProps {
  metric: MetricCardType;
}

export function StatCard({ metric }: StatCardProps) {
  return (
    <div className="stat-card elevation-1">
      <p className="section-header mb-1">{metric.label}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums">
        {metric.value}
      </p>
      {metric.subValue && (
        <p className="mt-0.5 text-xs text-muted-foreground">{metric.subValue}</p>
      )}
      {metric.status && (
        <div className="mt-2">
          <span
            className={cn(
              'inline-block h-1.5 w-8 rounded-full',
              metric.status === 'green' && 'bg-success',
              metric.status === 'yellow' && 'bg-warning',
              metric.status === 'red' && 'bg-destructive'
            )}
          />
        </div>
      )}
    </div>
  );
}

interface MetricsGridProps {
  metrics: MetricCardType[];
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {metrics.map((metric, i) => (
        <StatCard key={i} metric={metric} />
      ))}
    </div>
  );
}
