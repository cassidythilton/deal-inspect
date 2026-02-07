import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { Deal } from '@/types/tdr';

interface TDRSummaryModalProps {
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
}

export function TDRSummaryModal({ deal, isOpen, onClose }: TDRSummaryModalProps) {
  const [copied, setCopied] = useState(false);

  const summaryContent = `## TDR Summary: ${deal.account}

### Deal Overview
- **Account:** ${deal.account}
- **Opportunity:** ${deal.dealName}
- **ACV:** $${(deal.acv / 1000).toFixed(0)}K
- **Stage:** ${deal.stage}
- **Close Date:** ${deal.closeDate}
- **Owner:** ${deal.owner}

### Technical Assessment
The proposed solution addresses the customer's need for a comprehensive analytics platform. Key integration points have been identified with existing data sources.

### Risk Assessment
**Overall Risk Level:** ${deal.riskLevel === 'green' ? 'Low' : deal.riskLevel === 'yellow' ? 'Medium' : 'High'}

**Key Risks:**
- Competitive pressure requires accelerated timeline
- Integration complexity with legacy systems

### Partner Alignment
Partner signal is ${deal.partnerSignal}. SI engagement confirmed for implementation support.

### Recommendation
${deal.riskLevel === 'green' ? 'Approved for forecast. Strong executive alignment and clear business case.' : deal.riskLevel === 'yellow' ? 'Conditionally approved. Address identified risks before final commitment.' : 'Requires additional work. Key blockers must be resolved before proceeding.'}

---
*Generated ${new Date().toLocaleDateString()}*`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">TDR Executive Summary</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="absolute right-0 top-0 gap-1.5"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span className="text-xs">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="text-xs">Copy</span>
              </>
            )}
          </Button>
          
          <div className="mt-2 max-h-96 overflow-y-auto rounded-md border border-border bg-secondary/30 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {summaryContent}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
