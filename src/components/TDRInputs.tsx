import { useState, useCallback, useEffect, useRef } from 'react';
import { TDRStep } from '@/types/tdr';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Check, CheckCircle2, History, Loader2, CloudOff, Save, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { snowflakeStore } from '@/lib/snowflakeStore';
import type { StepInput } from '@/lib/snowflakeStore';
import { enhanceTDRField, isAIEnabled } from '@/lib/domoAi';
import type { EnhancementContext, EnhancementResult } from '@/lib/domoAi';
import { isDomoEnvironment } from '@/lib/domo';

/** Debounce interval for auto-save (ms) */
const AUTOSAVE_DELAY_MS = 1500;
/** sessionStorage key prefix for draft values */
const DRAFT_KEY_PREFIX = 'tdr-draft-';

interface TDRInputsProps {
  activeStep: TDRStep | undefined;
  /** The current session ID (needed for history lookups and draft cache) */
  sessionId?: string;
  /** Map of `stepId::fieldId` → saved value */
  inputValues?: Map<string, string>;
  /** Called on blur or select change to persist a field */
  onSaveInput?: (args: {
    stepId: string;
    stepLabel: string;
    fieldId: string;
    fieldLabel: string;
    fieldValue: string;
    stepOrder: number;
  }) => Promise<void>;
  /** Toggle the active step complete/incomplete */
  onToggleStepComplete?: (stepId: string) => void;
  /** Whether the active step is currently marked complete */
  isStepComplete?: boolean;
  /** All steps (for step order lookup) */
  allSteps?: TDRStep[];
  /** Deal metadata for AI enhancement context */
  dealContext?: {
    account?: string;
    acv?: number;
    stage?: string;
    dealType?: string;
    closeDate?: string;
    owner?: string;
    competitors?: string;
    partnerSignal?: string;
  };
}

interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  placeholder?: string;
  /** Hint text shown below the field for guidance */
  hint?: string;
  /** Whether this field is optional within a required step */
  optional?: boolean;
}

const stepInputConfigs: Record<string, { fields: FieldConfig[] }> = {
  // ── REQUIRED: Section 0 — Deal Context & Stakes (2-3 min) ──
  'context': {
    fields: [
      { id: 'strategic-value', label: 'Strategic Value', type: 'select', options: ['High', 'Medium', 'Low'] },
      { id: 'why-now', label: 'Why This Deal Matters Now', type: 'textarea', placeholder: 'Why is this deal worth technical inspection right now?', hint: 'Focus on timing — what makes this deal urgent or important today?' },
      { id: 'key-stakeholders', label: 'Key Stakeholders', type: 'text', placeholder: 'Names and roles of key decision makers...', optional: true },
    ],
  },
  // ── REQUIRED: Section 1 — Business Decision (5 min) ──
  'decision': {
    fields: [
      { id: 'customer-goal', label: 'Customer Decision', type: 'textarea', placeholder: 'The customer is trying to decide _____ so they can _____.', hint: 'One sentence. If you can\'t say it in one sentence — pause the review.' },
      { id: 'success-criteria', label: 'Success Criteria', type: 'textarea', placeholder: 'How will the customer measure success?', optional: true },
      { id: 'timeline', label: 'Decision Timeline', type: 'select', options: ['This Quarter', 'Next Quarter', '6+ Months'], optional: true },
    ],
  },
  // ── REQUIRED: Section 2 — Architecture: Current → Target (8-10 min) ──
  'current-arch': {
    fields: [
      { id: 'system-of-record', label: 'System of Record', type: 'textarea', placeholder: 'Where does the system of record live? (e.g., Snowflake, Databricks, BigQuery, on-prem SQL Server...)', hint: 'Is this platform strategic or incidental to the customer?' },
      { id: 'cloud-platform', label: 'Cloud / Data Platform', type: 'select', options: ['Snowflake', 'Databricks', 'BigQuery', 'Azure Synapse', 'AWS Redshift', 'On-Prem / Other', 'Multiple'] },
      { id: 'arch-truth', label: 'Architectural Truth', type: 'textarea', placeholder: 'What architectural truth must we accept in this account?', hint: 'What existing constraint or decision can we NOT change?' },
      { id: 'target-change', label: 'What Changes in Target State', type: 'textarea', placeholder: 'What is different in the target architecture vs. today?', hint: 'Don\'t list everything — focus on what changes and why.' },
      { id: 'pain-points', label: 'Pain Points', type: 'textarea', placeholder: 'Current challenges driving the change...', optional: true },
    ],
  },
  // ── REQUIRED: Section 3 — Domo's Composable Role (10 min) — TDR Heart ──
  'domo-role': {
    fields: [
      { id: 'entry-layer', label: 'Entry Layer', type: 'select', options: ['Data Integration', 'Data Warehouse', 'Visualization / BI', 'Embedded Analytics', 'App Development', 'Automation / Alerts', 'AI / ML'] },
      { id: 'in-scope', label: 'In-Scope Layers', type: 'textarea', placeholder: 'Which Domo capabilities are in scope for this deal?', hint: 'Be specific — what will Domo actually do in production?' },
      { id: 'out-of-scope', label: 'Out of Scope', type: 'textarea', placeholder: 'What is explicitly NOT Domo\'s job in this architecture?', hint: 'Drawing boundaries is as important as defining scope.' },
      { id: 'why-composition', label: 'Why This Composition Works Now', type: 'textarea', placeholder: 'Why does this specific configuration of Domo make sense for this customer right now?', hint: 'This is the TDR heart. If this answer is weak — the deal is not ready.' },
    ],
  },
  // ── REQUIRED: Section 4 — Risk & Verdict (5 min) ──
  'risk': {
    fields: [
      { id: 'top-risks', label: 'Top 1–2 Technical Risks', type: 'textarea', placeholder: 'What could go wrong technically?', hint: 'Focus on the risks that would actually kill the deal.' },
      { id: 'key-assumption', label: 'Key Assumption', type: 'textarea', placeholder: 'What is the ONE assumption that must be true for this deal to succeed?', hint: 'If this assumption is wrong, everything else falls apart.' },
      { id: 'verdict', label: 'Verdict', type: 'select', options: ['Proceed', 'Proceed with Corrections', 'Rework Before Advancing'], hint: 'Your professional judgment as an SE.' },
    ],
  },
  // ── OPTIONAL: Target Architecture Detail ──
  'target-arch': {
    fields: [
      { id: 'proposed-solution', label: 'Proposed Solution Detail', type: 'textarea', placeholder: 'Detailed target architecture description...' },
      { id: 'integration-points', label: 'Integration Points', type: 'text', placeholder: 'Key integrations required...' },
      { id: 'data-flow', label: 'Data Flow', type: 'textarea', placeholder: 'How will data flow through the system?' },
    ],
  },
  // ── OPTIONAL: Partner & AI Implications ──
  'partner': {
    fields: [
      { id: 'partner-name', label: 'Key Partner', type: 'text', placeholder: 'Which partner matters most?' },
      { id: 'partner-posture', label: 'Partner Posture', type: 'select', options: ['Amplifying', 'Neutral', 'Conflicting', 'None'] },
      { id: 'compute-alignment', label: 'Where Does Compute Execute?', type: 'textarea', placeholder: 'Partner cloud, Domo cloud, customer cloud...', optional: true },
    ],
  },
  // ── OPTIONAL: AI Strategy & Data Science ──
  'ai-strategy': {
    fields: [
      { id: 'ai-reality', label: 'AI Reality Check', type: 'select', options: ['Production today', 'Piloting', 'Roadmap only', 'Not applicable'], hint: 'Is AI real or future in this account?' },
      { id: 'autonomous-decision', label: 'Autonomous Decision Potential', type: 'textarea', placeholder: 'What decision could become autonomous?', optional: true },
    ],
  },
  // ── OPTIONAL: Usage & Adoption Detail (defer post-TDR) ──
  'usage': {
    fields: [
      { id: 'user-count', label: 'Expected Users', type: 'text', placeholder: 'Number of users...' },
      { id: 'adoption-plan', label: 'Adoption Plan', type: 'textarea', placeholder: 'How will adoption be driven?' },
      { id: 'success-metrics', label: 'Success Metrics', type: 'textarea', placeholder: 'KPIs for measuring success...' },
    ],
  },
};

// ── sessionStorage helpers ──────────────────────────────────────────
function getDraftKey(sessionId: string): string {
  return `${DRAFT_KEY_PREFIX}${sessionId}`;
}

function saveDraftToStorage(sessionId: string, drafts: Record<string, string>) {
  try {
    sessionStorage.setItem(getDraftKey(sessionId), JSON.stringify(drafts));
  } catch {
    // sessionStorage may not be available in some contexts — silently fail
  }
}

function loadDraftFromStorage(sessionId: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(getDraftKey(sessionId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function clearDraftFromStorage(sessionId: string) {
  try {
    sessionStorage.removeItem(getDraftKey(sessionId));
  } catch {
    // silent
  }
}

export function TDRInputs({
  activeStep,
  sessionId,
  inputValues,
  onSaveInput,
  onToggleStepComplete,
  isStepComplete,
  allSteps,
  dealContext,
}: TDRInputsProps) {
  // Track local field values for controlled inputs
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  // Track which fields have been touched (for save indicators)
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  // Track last-saved timestamp per field (for persistent indicators)
  const [lastSavedAt, setLastSavedAt] = useState<Record<string, number>>({});
  // Track fields that are dirty (changed locally but not yet saved to Snowflake)
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  // Debounce timer for auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether we recovered drafts from sessionStorage this mount
  const [recoveredDrafts, setRecoveredDrafts] = useState(false);
  // Whether a save is in-flight (for status indicator)
  const [autoSaving, setAutoSaving] = useState(false);

  // ── Refs for latest values (avoids stale closures in debounce/unmount) ──
  const localValuesRef = useRef<Record<string, string>>({});
  const onSaveInputRef = useRef(onSaveInput);
  const allStepsRef = useRef(allSteps);
  const sessionIdRef = useRef(sessionId);

  // Keep refs in sync
  useEffect(() => { localValuesRef.current = localValues; }, [localValues]);
  useEffect(() => { onSaveInputRef.current = onSaveInput; }, [onSaveInput]);
  useEffect(() => { allStepsRef.current = allSteps; }, [allSteps]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── AI Enhancement state ──
  const [enhancingField, setEnhancingField] = useState<string | null>(null);
  const [enhancementResult, setEnhancementResult] = useState<Record<string, EnhancementResult>>({});

  const handleEnhance = useCallback(async (fieldId: string, fieldConfig: FieldConfig) => {
    if (!activeStep || !allSteps) return;
    const key = `${activeStep.id}::${fieldId}`;
    const rawInput = localValuesRef.current[key]
      || inputValues?.get(key)
      || '';
    if (!rawInput.trim()) return;

    setEnhancingField(fieldId);

    const stepConfig = stepInputConfigs[activeStep.id];
    const siblingFields: EnhancementContext['siblingFields'] = [];
    if (stepConfig) {
      for (const f of stepConfig.fields) {
        if (f.id === fieldId) continue;
        const fKey = `${activeStep.id}::${f.id}`;
        const val = localValuesRef.current[fKey] || inputValues?.get(fKey) || '';
        if (val.trim()) siblingFields.push({ label: f.label, value: val });
      }
    }

    const crossStepFields: EnhancementContext['crossStepFields'] = [];
    for (const step of allSteps) {
      if (step.id === activeStep.id) continue;
      const sc = stepInputConfigs[step.id];
      if (!sc) continue;
      for (const f of sc.fields) {
        const fKey = `${step.id}::${f.id}`;
        const val = localValuesRef.current[fKey] || inputValues?.get(fKey) || '';
        if (val.trim()) {
          crossStepFields.push({ stepTitle: step.title, label: f.label, value: val });
        }
      }
    }

    try {
      const result = await enhanceTDRField({
        field: {
          id: fieldId,
          label: fieldConfig.label,
          placeholder: fieldConfig.placeholder,
          hint: fieldConfig.hint,
        },
        step: {
          id: activeStep.id,
          title: activeStep.title,
          coreQuestion: activeStep.coreQuestion,
        },
        rawInput,
        siblingFields,
        crossStepFields,
        dealMetadata: dealContext,
      });
      setEnhancementResult(prev => ({ ...prev, [fieldId]: result }));
    } catch (err) {
      console.error('[TDRInputs] Enhancement failed:', err);
    } finally {
      setEnhancingField(null);
    }
  }, [activeStep, allSteps, inputValues, dealContext]);

  const acceptEnhancement = useCallback((fieldId: string) => {
    const result = enhancementResult[fieldId];
    if (!result || !activeStep) return;
    handleChange(fieldId, result.enhanced);
    setEnhancementResult(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    if (onSaveInput && allSteps) {
      const stepIdx = allSteps.findIndex(s => s.id === activeStep.id);
      const fieldConfig = stepInputConfigs[activeStep.id]?.fields.find(f => f.id === fieldId);
      onSaveInput({
        stepId: activeStep.id,
        stepLabel: activeStep.title,
        fieldId,
        fieldLabel: fieldConfig?.label || fieldId,
        fieldValue: result.enhanced,
        stepOrder: stepIdx >= 0 ? stepIdx : 0,
      });
    }
  }, [enhancementResult, activeStep, allSteps, onSaveInput]);

  const dismissEnhancement = useCallback((fieldId: string) => {
    setEnhancementResult(prev => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  // ── Edit History Dialog ──
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyField, setHistoryField] = useState<{ stepId: string; fieldId: string; fieldLabel: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<StepInput[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = useCallback(async (stepId: string, fieldId: string, fieldLabel: string) => {
    if (!sessionId) return;
    setHistoryField({ stepId, fieldId, fieldLabel });
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryItems([]);

    try {
      const items = await snowflakeStore.getInputHistory(sessionId, stepId, fieldId);
      setHistoryItems(items);
    } catch (err) {
      console.error('[TDRInputs] Failed to load history:', err);
    }
    setHistoryLoading(false);
  }, [sessionId]);

  // ── Restore drafts from sessionStorage on mount / session change ────
  useEffect(() => {
    if (!sessionId) return;

    const drafts = loadDraftFromStorage(sessionId);
    if (Object.keys(drafts).length > 0) {
      console.log(`[TDRInputs] Recovered ${Object.keys(drafts).length} draft field(s) from sessionStorage`);
      setLocalValues(prev => {
        const merged = { ...prev, ...drafts };
        localValuesRef.current = merged;
        return merged;
      });

      // Mark all recovered fields as dirty so they get auto-saved
      for (const key of Object.keys(drafts)) {
        dirtyFieldsRef.current.add(key);
      }
      setRecoveredDrafts(true);
    }
  }, [sessionId]);

  // ── Core flush function (reads from refs — always fresh) ───────────
  const flushDirtyFields = useCallback(async () => {
    const saveFn = onSaveInputRef.current;
    const steps = allStepsRef.current;
    const sid = sessionIdRef.current;
    if (!saveFn || !steps) return;

    const dirty = Array.from(dirtyFieldsRef.current);
    if (dirty.length === 0) return;

    setAutoSaving(true);
    for (const key of dirty) {
      const [stepId, fieldId] = key.split('::');
      if (!stepId || !fieldId) continue;

      // Always read from ref (never stale)
      const value = localValuesRef.current[key];
      if (value === undefined) continue;

      const stepConfig = stepInputConfigs[stepId];
      const fieldConfig = stepConfig?.fields.find(f => f.id === fieldId);
      const stepIdx = steps.findIndex(s => s.id === stepId);
      const step = steps[stepIdx];

      try {
        await saveFn({
          stepId,
          stepLabel: step?.title || stepId,
          fieldId,
          fieldLabel: fieldConfig?.label || fieldId,
          fieldValue: value,
          stepOrder: stepIdx >= 0 ? stepIdx : 0,
        });
        dirtyFieldsRef.current.delete(key);
        setSavedFields(prev => new Set(prev).add(key));
        setLastSavedAt(prev => ({ ...prev, [key]: Date.now() }));
        console.log(`[TDRInputs] Auto-saved: ${key}`);
      } catch (err) {
        console.error(`[TDRInputs] Auto-save failed for ${key}:`, err);
      }
    }

    // Clear drafts from sessionStorage if all dirty fields flushed
    if (sid && dirtyFieldsRef.current.size === 0) {
      clearDraftFromStorage(sid);
    }
    setAutoSaving(false);
  }, []); // No deps needed — reads everything from refs

  // ── Auto-save recovered drafts to Snowflake ────────────────────────
  useEffect(() => {
    if (!recoveredDrafts || !onSaveInput || !sessionId || !allSteps) return;

    console.log(`[TDRInputs] Auto-saving ${dirtyFieldsRef.current.size} recovered draft(s) to Snowflake...`);
    flushDirtyFields().then(() => {
      if (dirtyFieldsRef.current.size === 0) {
        setRecoveredDrafts(false);
      }
    });
  }, [recoveredDrafts, onSaveInput, sessionId, allSteps, flushDirtyFields]);

  // ── Flush on unmount (fire-and-forget) + clear timer ───────────────
  useEffect(() => {
    return () => {
      // Cancel pending debounce
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Flush all remaining dirty fields to Snowflake (fire-and-forget)
      const dirty = Array.from(dirtyFieldsRef.current);
      if (dirty.length > 0) {
        console.log(`[TDRInputs] Unmounting with ${dirty.length} dirty field(s) — flushing...`);
        flushDirtyFields();
      }

      // Also ensure sessionStorage has the latest as a safety net
      const sid = sessionIdRef.current;
      if (sid && Object.keys(localValuesRef.current).length > 0) {
        saveDraftToStorage(sid, localValuesRef.current);
      }
    };
  }, [flushDirtyFields]);

  // ── beforeunload: ensure sessionStorage backup on page close ───────
  useEffect(() => {
    const handler = () => {
      const sid = sessionIdRef.current;
      if (sid && Object.keys(localValuesRef.current).length > 0) {
        saveDraftToStorage(sid, localValuesRef.current);
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── ⌘S / Ctrl+S global save ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        // Cancel pending debounce and flush immediately
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        flushDirtyFields();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flushDirtyFields]);

  if (!activeStep) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a step to begin</p>
      </div>
    );
  }

  const config = stepInputConfigs[activeStep.id] || { fields: [] };
  const stepOrder = allSteps ? allSteps.findIndex(s => s.id === activeStep.id) : 0;

  // Get the current value for a field: local draft > saved > empty
  const getFieldValue = (fieldId: string): string => {
    const localKey = `${activeStep.id}::${fieldId}`;
    if (localValues[localKey] !== undefined) return localValues[localKey];
    if (inputValues) {
      const saved = inputValues.get(`${activeStep.id}::${fieldId}`);
      if (saved) return saved;
    }
    return '';
  };

  // Handle local change (controlled input) — caches to sessionStorage + starts debounce timer
  const handleChange = (fieldId: string, value: string) => {
    const key = `${activeStep.id}::${fieldId}`;

    setLocalValues(prev => {
      const next = { ...prev, [key]: value };
      // Keep ref in sync immediately (critical for debounce reads)
      localValuesRef.current = next;

      // Immediately cache to sessionStorage (survives Domo data-refresh reloads)
      if (sessionId) {
        saveDraftToStorage(sessionId, next);
      }

      return next;
    });

    // Mark field as dirty
    dirtyFieldsRef.current.add(key);

    // Clear saved indicator when editing
    setSavedFields(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    // Reset the auto-save debounce timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      flushDirtyFields();
    }, AUTOSAVE_DELAY_MS);
  };

  // Handle blur — immediately flush this field to Snowflake
  const handleBlur = async (fieldId: string, fieldLabel: string) => {
    if (!onSaveInput || !activeStep) return;

    const key = `${activeStep.id}::${fieldId}`;
    const value = localValues[key];
    if (value === undefined) return; // Nothing was changed locally

    // Cancel pending debounce for this field (we're saving now)
    dirtyFieldsRef.current.delete(key);

    await onSaveInput({
      stepId: activeStep.id,
      stepLabel: activeStep.title,
      fieldId,
      fieldLabel,
      fieldValue: value,
      stepOrder,
    });

    // Show saved indicator
    setSavedFields(prev => new Set(prev).add(key));

    // Clean up sessionStorage if no more dirty fields
    if (sessionId && dirtyFieldsRef.current.size === 0) {
      clearDraftFromStorage(sessionId);
    }
  };

  // Handle select change — persist immediately
  const handleSelectChange = async (fieldId: string, fieldLabel: string, value: string) => {
    const key = `${activeStep.id}::${fieldId}`;
    setLocalValues(prev => ({ ...prev, [key]: value }));

    if (onSaveInput && activeStep) {
      await onSaveInput({
        stepId: activeStep.id,
        stepLabel: activeStep.title,
        fieldId,
        fieldLabel,
        fieldValue: value,
        stepOrder,
      });
      setSavedFields(prev => new Set(prev).add(key));
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-medium">{activeStep.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{activeStep.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-save status */}
          {autoSaving && (
            <span className="flex items-center gap-1 text-2xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              saving…
            </span>
          )}
          {dirtyFieldsRef.current.size > 0 && !autoSaving && (
            <span className="flex items-center gap-1 text-2xs text-amber-500">
              <Save className="h-3 w-3" />
              unsaved
            </span>
          )}
          {dirtyFieldsRef.current.size === 0 && !autoSaving && Object.keys(lastSavedAt).length > 0 && (
            <span className="flex items-center gap-1 text-2xs text-emerald-600">
              <Check className="h-3 w-3" />
              all saved
            </span>
          )}
          {onToggleStepComplete && (
            <Button
              variant={isStepComplete ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'gap-1.5 text-xs',
                isStepComplete && 'bg-emerald-600 hover:bg-emerald-700'
              )}
              onClick={() => onToggleStepComplete(activeStep.id)}
            >
              {isStepComplete ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Mark Complete
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {recoveredDrafts && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
          <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Unsaved inputs recovered from your last session. Auto-saving to Snowflake…
          </span>
        </div>
      )}

      {/* Core forcing question */}
      {activeStep.coreQuestion && (
        <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 dark:border-violet-800/50 dark:bg-violet-950/20">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
            Core Question
          </p>
          <p className="mt-0.5 text-sm text-violet-600 dark:text-violet-400 italic">
            {activeStep.coreQuestion}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {config.fields.map((field) => {
          const fieldKey = `${activeStep.id}::${field.id}`;
          const isSaved = savedFields.has(fieldKey);
          const currentValue = getFieldValue(field.id);

          return (
            <div key={field.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor={field.id} className="text-xs font-medium">
                  {field.label}
                </Label>
                {field.optional && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-2xs text-muted-foreground">
                    optional
                  </span>
                )}
                {isSaved && (
                  <span className="flex items-center gap-0.5 text-2xs text-emerald-600" title={lastSavedAt[fieldKey] ? `Saved ${new Date(lastSavedAt[fieldKey]).toLocaleTimeString()}` : 'Saved'}>
                    <Check className="h-2.5 w-2.5" />
                    saved
                  </span>
                )}
                {dirtyFieldsRef.current.has(fieldKey) && !isSaved && (
                  <span className="text-2xs text-amber-500 animate-pulse">typing…</span>
                )}
                {sessionId && currentValue && (
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-0.5 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => openHistory(activeStep.id, field.id, field.label)}
                    title="View edit history"
                  >
                    <History className="h-3 w-3" />
                    history
                  </button>
                )}
              </div>
              {field.type === 'text' && (
                <Input
                  id={field.id}
                  placeholder={field.placeholder}
                  className="h-9 text-sm"
                  value={currentValue}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  onBlur={() => handleBlur(field.id, field.label)}
                />
              )}
              {field.type === 'textarea' && (
                <div className="space-y-2">
                  <Textarea
                    id={field.id}
                    placeholder={field.placeholder}
                    className="min-h-20 resize-none text-sm"
                    value={currentValue}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    onBlur={() => handleBlur(field.id, field.label)}
                  />
                  {/* AI Enhancement affordance */}
                  {isDomoEnvironment() && isAIEnabled() && (
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1 rounded-md px-2 py-1 text-2xs transition-colors',
                          currentValue.trim()
                            ? 'text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30'
                            : 'cursor-not-allowed text-muted-foreground/40',
                        )}
                        disabled={!currentValue.trim() || enhancingField === field.id}
                        onClick={() => handleEnhance(field.id, field)}
                      >
                        {enhancingField === field.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {enhancingField === field.id ? 'Enhancing…' : 'Enhance'}
                      </button>
                    </div>
                  )}
                  {/* Enhancement result */}
                  {enhancementResult[field.id] && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800/50 dark:bg-violet-950/20">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-2xs font-medium text-violet-700 dark:text-violet-300">
                          <Sparkles className="h-3 w-3" />
                          AI-Enhanced
                        </span>
                        <span className="text-2xs text-muted-foreground">
                          Using: {enhancementResult[field.id].contextSources.join(', ')}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">
                        {enhancementResult[field.id].enhanced}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1 bg-violet-600 text-xs hover:bg-violet-700"
                          onClick={() => acceptEnhancement(field.id)}
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            handleChange(field.id, enhancementResult[field.id].enhanced);
                            dismissEnhancement(field.id);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-muted-foreground"
                          onClick={() => dismissEnhancement(field.id)}
                        >
                          <X className="h-3 w-3" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {field.type === 'select' && (
                <Select
                  value={currentValue || ''}
                  onValueChange={(v) => handleSelectChange(field.id, field.label, v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option.toLowerCase()} className="text-sm">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.hint && (
                <p className="text-2xs text-muted-foreground italic">{field.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Edit History</DialogTitle>
            <DialogDescription className="text-xs">
              {historyField?.fieldLabel} — all saved values (newest first)
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : historyItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No edit history found for this field.
            </p>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {historyItems
                .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
                .map((item, idx) => (
                  <div
                    key={item.inputId || idx}
                    className={cn(
                      'rounded-md border p-3',
                      idx === 0 ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-muted-foreground">
                        {item.savedAt
                          ? new Date(item.savedAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Unknown date'}
                      </span>
                      {idx === 0 && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-2xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          current
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{item.fieldValue}</p>
                    {item.savedBy && (
                      <p className="mt-1 text-2xs text-muted-foreground">by {item.savedBy}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
