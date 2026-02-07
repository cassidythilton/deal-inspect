import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TDRSteps } from '@/components/TDRSteps';
import { TDRInputs } from '@/components/TDRInputs';
import { TDRIntelligence } from '@/components/TDRIntelligence';
import { tdrSteps, mockDeals } from '@/data/mockData';
import { TDRStep } from '@/types/tdr';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function TDRWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealId = searchParams.get('deal') || '1';
  
  const deal = mockDeals.find((d) => d.id === dealId) || mockDeals[0];
  
  const [steps, setSteps] = useState<TDRStep[]>(tdrSteps);
  
  const activeStep = steps.find((s) => s.isActive);

  const handleStepClick = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => ({
        ...s,
        isActive: s.id === stepId,
      }))
    );
  };

  // Mock intelligence data
  const missingInfo = ['Partner commitment documentation', 'Technical architecture diagram', 'Executive sponsor confirmation'];
  const riskFlags = ['Competitive pressure from Tableau', 'Q1 budget cycle constraint'];

  return (
    <div className="flex h-screen flex-col">
      {/* Minimal header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => navigate('/')}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-xs">Back</span>
        </Button>
        <div className="h-4 w-px bg-border" />
        <div>
          <span className="text-sm font-medium">{deal.account}</span>
          <span className="ml-2 text-xs text-muted-foreground">TDR Workspace</span>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Steps */}
        <aside className="w-64 shrink-0 border-r border-border bg-card">
          <TDRSteps steps={steps} onStepClick={handleStepClick} />
        </aside>

        {/* Center Panel - Inputs */}
        <main className="flex-1 overflow-y-auto bg-background">
          <TDRInputs activeStep={activeStep} />
        </main>

        {/* Right Panel - Intelligence */}
        <aside className="w-72 shrink-0 border-l border-border bg-card">
          <TDRIntelligence
            deal={deal}
            readinessLevel={deal.riskLevel}
            missingInfo={missingInfo}
            riskFlags={riskFlags}
          />
        </aside>
      </div>
    </div>
  );
}
