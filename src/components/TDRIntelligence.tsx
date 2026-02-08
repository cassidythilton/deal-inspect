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
import { 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  Link, 
  Save, 
  Sparkles,
  Building2,
  Users,
  User,
  Info,
} from 'lucide-react';
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

  // Get short stage name
  const getShortStage = (stage: string) => {
    const lower = stage.toLowerCase();
    if (lower.includes('validation')) return 'Validation';
    if (lower.includes('discovery')) return 'Discovery';
    if (lower.includes('closing')) return 'Closing';
    if (lower.includes('proposal')) return 'Proposal';
    return stage.split(' ').slice(0, 1).join(' ');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Deal Info Header */}
      {deal && (
        <div className="border-b border-border/60 p-4">
          <h3 className="text-base font-semibold">{deal.account}</h3>
          <p className="text-sm text-muted-foreground">{deal.dealName}</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium tabular-nums">${(deal.acv / 1000).toFixed(0)}K ACV</span>
            <span>·</span>
            <span>{getShortStage(deal.stage)}</span>
          </div>
        </div>
      )}

      {/* Deal Team Section */}
      {deal && (
        <div className="border-b border-border/60 p-4">
          <p className="section-header mb-3">DEAL TEAM</p>
          <div className="space-y-3">
            {/* Account Executive */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Executive</p>
                <p className="text-sm font-medium">{deal.owner || 'Not assigned'}</p>
              </div>
            </div>
            
            {/* SE Manager */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SE Manager</p>
                <p className="text-sm font-medium">{deal.seManager || 'Not assigned'}</p>
              </div>
            </div>
            
            {/* Sales Consultant (SE) */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sales Consultant (SE)</p>
                <p className="text-sm font-medium">{deal.salesConsultant || 'Not assigned'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Readiness Score */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">READINESS SCORE</p>
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-md border px-3 py-2',
            readinessLevel === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
            readinessLevel === 'yellow' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
            readinessLevel === 'red' && 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400'
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
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">RISK FLAGS</p>
        {riskFlags.length > 0 ? (
          <ul className="space-y-1.5">
            {riskFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="text-muted-foreground">{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span>No significant risks identified</span>
          </div>
        )}
      </div>

      {/* Missing Information */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">MISSING INFORMATION</p>
        {missingInfo.length > 0 ? (
          <ul className="space-y-1.5">
            {missingInfo.map((info, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">{info}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">All required information collected</p>
        )}
      </div>

      {/* Evidence Links */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">EVIDENCE</p>
        <div className="space-y-1">
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Link className="h-3.5 w-3.5" />
            <span>Opportunity in CRM</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Technical Assessment</span>
          </button>
        </div>
      </div>

      {/* Outcome Selector */}
      <div className="border-b border-border/60 p-4">
        <p className="section-header mb-2">FINAL OUTCOME</p>
        <Select>
          <SelectTrigger className="h-10 text-sm">
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
