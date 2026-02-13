import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TDRSteps } from '@/components/TDRSteps';
import { TDRInputs } from '@/components/TDRInputs';
import { TDRIntelligence } from '@/components/TDRIntelligence';
import { TDRChat } from '@/components/TDRChat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { tdrSteps, mockDeals } from '@/data/mockData';
import { TDRStep } from '@/types/tdr';
import { ChevronLeft, Users, User, Loader2, Save, Brain, MessageSquare, Briefcase, Tag, FileDown, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '@/hooks/useDomo';
import { useTDRSession } from '@/hooks/useTDRSession';
import { tdrReadout } from '@/lib/tdrReadout';
import { TDRShareDialog } from '@/components/TDRShareDialog';
import { CortexLogo, SnowflakeLogo } from '@/components/CortexBranding';

/** Debounce delay for thesis auto-save */
const THESIS_AUTOSAVE_MS = 1500;

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

  // ── Thesis field (always-visible, Sprint 17) with auto-save ──
  const thesisKey = 'thesis::domo-thesis';
  const thesisValue = inputValues?.get(thesisKey) || '';
  const [localThesis, setLocalThesis] = useState<string | null>(null);
  const [thesisSaved, setThesisSaved] = useState(false);
  const thesisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localThesisRef = useRef<string | null>(null);
  const saveInputRef = useRef(saveInput);
  useEffect(() => { saveInputRef.current = saveInput; }, [saveInput]);

  const flushThesis = useCallback(async () => {
    const val = localThesisRef.current;
    if (val === null) return;
    try {
      await saveInputRef.current({
        stepId: 'thesis',
        stepLabel: 'Thesis',
        fieldId: 'domo-thesis',
        fieldLabel: 'Why Domo Belongs',
        fieldValue: val,
        stepOrder: -1,
      });
      setThesisSaved(true);
    } catch (err) {
      console.error('[TDRWorkspace] Thesis auto-save failed:', err);
    }
  }, []);

  const handleThesisChange = useCallback((value: string) => {
    setLocalThesis(value);
    localThesisRef.current = value;
    setThesisSaved(false);

    // Debounced auto-save
    if (thesisTimerRef.current) clearTimeout(thesisTimerRef.current);
    thesisTimerRef.current = setTimeout(() => {
      flushThesis();
    }, THESIS_AUTOSAVE_MS);
  }, [flushThesis]);

  const handleThesisBlur = useCallback(async () => {
    if (localThesis === null || localThesis === thesisValue) return;
    // Cancel debounce and flush immediately
    if (thesisTimerRef.current) {
      clearTimeout(thesisTimerRef.current);
      thesisTimerRef.current = null;
    }
    await flushThesis();
  }, [localThesis, thesisValue, flushThesis]);

  // Flush thesis on unmount
  useEffect(() => {
    return () => {
      if (thesisTimerRef.current) {
        clearTimeout(thesisTimerRef.current);
      }
      if (localThesisRef.current !== null) {
        flushThesis();
      }
    };
  }, [flushThesis]);

  // Sprint 13: Export Readout
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Sprint 14: Slack Share
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

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
            {/* Export PDF — icon-only */}
            <button
              className="h-6 w-6 ml-2 flex items-center justify-center rounded text-slate-500 hover:text-violet-400 hover:scale-110 transition-all duration-200 ease-out disabled:opacity-30 disabled:pointer-events-none"
              onClick={handleExportReadout}
              disabled={exportLoading || !session?.sessionId || session?.sessionId.startsWith('local-') || session?.sessionId.startsWith('fallback-')}
              title="Export PDF"
            >
              {exportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 transition-transform duration-200" />}
            </button>
            {/* Share to Slack — icon-only, turns Slack pink on hover */}
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-[#E01E5A] hover:scale-110 transition-all duration-200 ease-out disabled:opacity-30 disabled:pointer-events-none"
              onClick={() => setShareDialogOpen(true)}
              disabled={!session?.sessionId || session?.sessionId.startsWith('local-') || session?.sessionId.startsWith('fallback-')}
              title="Share to Slack"
            >
              <svg className="h-3.5 w-3.5 transition-transform duration-200" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z"/></svg>
            </button>
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

      {/* ── Thesis Bar (always visible, Sprint 17) ── */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1.5 pt-1.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Thesis</span>
          </div>
          <div className="flex-1 relative">
            <Textarea
              placeholder="In one sentence: Why does Domo belong in this architecture?"
              className="min-h-[40px] h-[40px] resize-none text-sm border-violet-200 dark:border-violet-800/50 focus:border-violet-400 dark:focus:border-violet-600 bg-violet-50/30 dark:bg-violet-950/10"
              value={localThesis !== null ? localThesis : thesisValue}
              onChange={(e) => handleThesisChange(e.target.value)}
              onBlur={handleThesisBlur}
            />
            {thesisSaved && (
              <span className="absolute right-2 top-2 flex items-center gap-0.5 text-2xs text-emerald-600">
                <Check className="h-2.5 w-2.5" />
                saved
              </span>
            )}
          </div>
        </div>
        <p className="mt-1 ml-[72px] text-2xs text-muted-foreground italic">
          If this sentence is strong — the deal is probably solid. If it's weak — the rest doesn't matter.
        </p>
      </div>

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
                <CortexLogo className="h-3 w-3" />
                Intelligence
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="gap-1.5 data-[state=active]:bg-[#332d50] data-[state=active]:text-white text-slate-400 text-xs"
              >
                <SnowflakeLogo className="h-3 w-3" />
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
                completedStepCount={stepsWithCompletion.filter(s => s.required !== false && s.isComplete).length}
                requiredStepCount={stepsWithCompletion.filter(s => s.required !== false).length}
                optionalCompletedCount={stepsWithCompletion.filter(s => s.required === false && s.isComplete).length}
                optionalTotalCount={stepsWithCompletion.filter(s => s.required === false).length}
                totalStepCount={stepsWithCompletion.length}
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

      {/* Sprint 14: Slack Share Dialog */}
      <TDRShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        sessionId={session?.sessionId || ''}
        accountName={deal.account}
        dealTeam={{
          ae: deal.accountExecutive,
          se: deal.salesConsultant,
          seManager: deal.seManager,
          pocArchitect: deal.pocSalesConsultant,
          owner: deal.owner,
        }}
      />
    </div>
  );
}
