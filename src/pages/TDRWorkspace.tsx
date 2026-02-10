import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TDRSteps } from '@/components/TDRSteps';
import { TDRInputs } from '@/components/TDRInputs';
import { TDRIntelligence } from '@/components/TDRIntelligence';
import { TDRChat } from '@/components/TDRChat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { tdrSteps, mockDeals } from '@/data/mockData';
import { TDRStep } from '@/types/tdr';
import { ChevronLeft, Users, User, Loader2, Save, Brain, MessageSquare, Briefcase, Tag, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '@/hooks/useDomo';
import { useTDRSession } from '@/hooks/useTDRSession';
import { tdrReadout } from '@/lib/tdrReadout';

export default function TDRWorkspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealId = searchParams.get('deal') || '1';
  
  // Try to get deal from Domo data first, fall back to mock
  const { deals: domoDeals, isDomoConnected } = useDeals();
  
  const deal = useMemo(() => {
    if (isDomoConnected && domoDeals.length > 0) {
      return domoDeals.find((d) => d.id === dealId) || domoDeals[0];
    }
    return mockDeals.find((d) => d.id === dealId) || mockDeals[0];
  }, [domoDeals, isDomoConnected, dealId]);
  
  // ── Session lifecycle (Snowflake persistence) ──
  const {
    session,
    isLoading: sessionLoading,
    inputValues,
    completedSteps,
    saveInput,
    markStepComplete,
    markStepIncomplete,
    isSaving,
  } = useTDRSession(deal);

  // ── Step management ──
  const [steps, setSteps] = useState<TDRStep[]>(
    tdrSteps.map(s => ({ ...s, isComplete: false, isActive: s.id === 'context' }))
  );

  // Sync completed steps from session into step state
  const stepsWithCompletion = useMemo(() => {
    return steps.map(s => ({
      ...s,
      isComplete: completedSteps.has(s.id),
    }));
  }, [steps, completedSteps]);
  
  const activeStep = stepsWithCompletion.find((s) => s.isActive);

  const handleStepClick = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => ({
        ...s,
        isActive: s.id === stepId,
      }))
    );
  };

  // ── Step completion toggle ──
  const handleToggleStepComplete = useCallback((stepId: string) => {
    if (completedSteps.has(stepId)) {
      markStepIncomplete(stepId);
    } else {
      markStepComplete(stepId);
    }
  }, [completedSteps, markStepComplete, markStepIncomplete]);

  // Mock intelligence data based on deal
  const missingInfo = deal.isPartnerPlay 
    ? ['Partner commitment documentation', 'Technical architecture diagram']
    : ['Technical architecture diagram', 'Executive sponsor confirmation'];
  
  const riskFlags = deal.riskLevel === 'green' 
    ? []
    : deal.riskLevel === 'yellow'
    ? ['Competitive pressure identified']
    : ['Critical timeline risk', 'Budget constraints'];

  // Sprint 13: Export Readout
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportReadout = useCallback(async () => {
    if (!session?.sessionId || session.sessionId.startsWith('local-') || session.sessionId.startsWith('fallback-')) return;
    setExportLoading(true);
    setExportError(null);
    try {
      await tdrReadout.downloadReadout(session.sessionId, deal.account);
    } catch (err) {
      console.error('[TDRWorkspace] Export readout failed:', err);
      setExportError(String(err));
    }
    setExportLoading(false);
  }, [session?.sessionId, deal.account]);

  // Session status pill
  const sessionStatusLabel = session
    ? session.sessionId.startsWith('fallback-') || session.sessionId.startsWith('local-')
      ? 'local'
      : session.status === 'in-progress'
      ? `TDR #${session.iteration || 1}`
      : 'completed'
    : 'loading';

  return (
    <div className="flex h-screen flex-col">
      {/* Header with Manager/SE pills */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{deal.account}</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
              {sessionStatusLabel}
            </span>
            {deal.dealType && (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                deal.dealType.toLowerCase().includes('new logo')
                  ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20'
              }`}>
                <Tag className="h-3 w-3" />
                {deal.dealType}
              </span>
            )}
            {isSaving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                <Save className="h-3 w-3" />
                saving...
              </span>
            )}
            {/* Sprint 13: Export Readout */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs ml-2"
              onClick={handleExportReadout}
              disabled={exportLoading || !session?.sessionId || session?.sessionId.startsWith('local-') || session?.sessionId.startsWith('fallback-')}
              title="Export a polished PDF readout of this TDR"
            >
              {exportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
              Export PDF
            </Button>
            {exportError && (
              <span className="text-2xs text-destructive ml-1" title={exportError}>Export failed</span>
            )}
          </div>
        </div>
        
        {/* Deal team pills */}
        <div className="flex items-center gap-2">
          {deal.accountExecutive && (
            <div className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 dark:bg-blue-950/30 dark:border-blue-800">
              <Briefcase className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-600 dark:text-blue-400">AE:</span>
              <span className="text-xs font-medium text-blue-800 dark:text-blue-300">{deal.accountExecutive}</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Manager:</span>
            <span className="text-xs font-medium">{deal.owner}</span>
          </div>
          {deal.seManager && (
            <div className="flex items-center gap-2 rounded-full bg-violet-50 border border-violet-200 px-3 py-1.5 dark:bg-violet-950/30 dark:border-violet-800">
              <Users className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs text-violet-600 dark:text-violet-400">SE Mgr:</span>
              <span className="text-xs font-medium text-violet-800 dark:text-violet-300">{deal.seManager}</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">SE:</span>
            <span className="text-xs font-medium">{deal.salesConsultant || 'Not assigned'}</span>
          </div>
          {deal.pocSalesConsultant && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 dark:bg-emerald-950/30 dark:border-emerald-800">
              <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400">PoC SE:</span>
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">{deal.pocSalesConsultant}</span>
            </div>
          )}
        </div>
      </header>

      {/* Loading overlay */}
      {sessionLoading && (
        <div className="flex h-16 items-center justify-center border-b border-border bg-card/50">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading TDR session...</span>
        </div>
      )}

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Steps */}
        <aside className="w-64 shrink-0 border-r border-border bg-card">
          <TDRSteps
            steps={stepsWithCompletion}
            onStepClick={handleStepClick}
          />
        </aside>

        {/* Center Panel - Inputs */}
        <main className="flex-1 overflow-y-auto bg-background">
          <TDRInputs
            activeStep={activeStep}
            sessionId={session?.sessionId}
            inputValues={inputValues}
            onSaveInput={saveInput}
            onToggleStepComplete={handleToggleStepComplete}
            isStepComplete={activeStep ? completedSteps.has(activeStep.id) : false}
            allSteps={stepsWithCompletion}
          />
        </main>

        {/* Right Panel - Intelligence + Chat (tabbed, dark purple) */}
        <aside className="w-[42rem] shrink-0 border-l border-[#2a2540] bg-[#1B1630] overflow-hidden flex flex-col">
          <Tabs defaultValue="intel" className="flex flex-col h-full">
            <TabsList className="shrink-0 mx-3 mt-3 bg-[#2a2540] border border-[#3a3460]">
              <TabsTrigger
                value="intel"
                className="gap-1.5 data-[state=active]:bg-[#332d50] data-[state=active]:text-white text-slate-400 text-xs"
              >
                <Brain className="h-3 w-3" />
                Intelligence
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="gap-1.5 data-[state=active]:bg-[#332d50] data-[state=active]:text-white text-slate-400 text-xs"
              >
                <MessageSquare className="h-3 w-3" />
                Chat
              </TabsTrigger>
            </TabsList>
            <TabsContent value="intel" className="flex-1 overflow-y-auto mt-0">
              <TDRIntelligence
                deal={deal}
                readinessLevel={deal.riskLevel}
                missingInfo={missingInfo}
                riskFlags={riskFlags}
                sessionId={session?.sessionId}
              />
            </TabsContent>
            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              <TDRChat
                deal={deal}
                sessionId={session?.sessionId}
                activeStep={activeStep}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
