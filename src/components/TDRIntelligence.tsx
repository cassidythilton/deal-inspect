import { useState } from 'react';
import { Deal, ReadinessLevel } from '@/types/tdr';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, CheckCircle, FileText, Link, Save, Sparkles } from 'lucide-react';
import { TDRSummaryModal } from './TDRSummaryModal';

interface TDRIntelligenceProps {
  deal?: Deal;
  readinessLevel: ReadinessLevel;
  missingInfo: string[];
  riskFlags: string[];
}

export function TDRIntelligence({
  deal,
  readinessLevel,
  missingInfo,
  riskFlags,
}: TDRIntelligenceProps) {
  const [showSummary, setShowSummary] = useState(false);
  return (
    <div className="flex h-full flex-col">
      {/* Deal Info Header */}
      {deal && (
        <div className="border-b border-border/60 p-4">
          <h3 className="text-sm font-medium">{deal.account}</h3>
          <p className="text-xs text-muted-foreground">{deal.dealName}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">${(deal.acv / 1000).toFixed(0)}K ACV</span>
            <span>·</span>
            <span>{deal.stage}</span>
          </div>
        </div>
      )}

      {/* Readiness Score */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">Readiness Score</p>
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-2',
            readinessLevel === 'green' && 'readiness-green',
            readinessLevel === 'yellow' && 'readiness-yellow',
            readinessLevel === 'red' && 'readiness-red'
          )}
        >
          {readinessLevel === 'green' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-sm font-medium capitalize">{readinessLevel}</span>
        </div>
      </div>

      {/* Risk Flags */}
      {riskFlags.length > 0 && (
        <div className="border-b border-border/60 p-4">
          <p className="section-header mb-2">Risk Flags</p>
          <ul className="space-y-1.5">
            {riskFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
                <span className="text-muted-foreground">{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing Information */}
      {missingInfo.length > 0 && (
        <div className="border-b border-border/60 p-4">
          <p className="section-header mb-2">Missing Information</p>
          <ul className="space-y-1.5">
            {missingInfo.map((info, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">{info}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence Links */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">Evidence</p>
        <div className="space-y-1">
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Link className="h-3 w-3" />
            <span>Opportunity in CRM</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <FileText className="h-3 w-3" />
            <span>Technical Assessment</span>
          </button>
        </div>
      </div>

      {/* Outcome Selector */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">Final Outcome</p>
        <Select>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select outcome..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="approved">Approved for Forecast</SelectItem>
            <SelectItem value="needs-work">Needs More Work</SelectItem>
            <SelectItem value="deferred">Deferred</SelectItem>
            <SelectItem value="at-risk">Flagged At-Risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto p-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full gap-2" size="sm">
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button variant="outline" className="w-full gap-2" size="sm">
            <CheckCircle className="h-3.5 w-3.5" />
            Finalize TDR
          </Button>
          <Button className="w-full gap-2" size="sm" onClick={() => setShowSummary(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Summary
          </Button>
        </div>
      </div>

      {/* Summary Modal */}
      {deal && (
        <TDRSummaryModal
          deal={deal}
          isOpen={showSummary}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
