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
import { Check, CheckCircle2, History, Loader2, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { snowflakeStore } from '@/lib/snowflakeStore';
import type { StepInput } from '@/lib/snowflakeStore';

/** Debounce interval for auto-save (ms) */
const AUTOSAVE_DELAY_MS = 2000;
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
}

const stepInputConfigs: Record<string, { fields: { id: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[]; placeholder?: string }[] }> = {
  'context': {
    fields: [
      { id: 'strategic-value', label: 'Strategic Value', type: 'select', options: ['High', 'Medium', 'Low'] },
      { id: 'business-impact', label: 'Business Impact', type: 'textarea', placeholder: 'Describe the business impact...' },
      { id: 'key-stakeholders', label: 'Key Stakeholders', type: 'text', placeholder: 'List key stakeholders...' },
    ],
  },
  'decision': {
    fields: [
      { id: 'customer-goal', label: 'Customer Goal', type: 'textarea', placeholder: 'What is the customer trying to achieve?' },
      { id: 'timeline', label: 'Decision Timeline', type: 'select', options: ['This Quarter', 'Next Quarter', '6+ Months'] },
      { id: 'success-criteria', label: 'Success Criteria', type: 'textarea', placeholder: 'How will success be measured?' },
    ],
  },
  'current-arch': {
    fields: [
      { id: 'existing-systems', label: 'Existing Systems', type: 'textarea', placeholder: 'Current data systems and tools...' },
      { id: 'data-sources', label: 'Data Sources', type: 'text', placeholder: 'Key data sources...' },
      { id: 'pain-points', label: 'Pain Points', type: 'textarea', placeholder: 'Current challenges and limitations...' },
    ],
  },
  'target-arch': {
    fields: [
      { id: 'proposed-solution', label: 'Proposed Solution', type: 'textarea', placeholder: 'Describe the target architecture...' },
      { id: 'integration-points', label: 'Integration Points', type: 'text', placeholder: 'Key integrations required...' },
      { id: 'data-flow', label: 'Data Flow', type: 'textarea', placeholder: 'How will data flow through the system?' },
    ],
  },
  'domo-role': {
    fields: [
      { id: 'domo-positioning', label: 'Domo Positioning', type: 'select', options: ['Primary Platform', 'Complementary', 'Point Solution'] },
      { id: 'key-capabilities', label: 'Key Capabilities Used', type: 'textarea', placeholder: 'Which Domo capabilities are core to this deal?' },
      { id: 'differentiation', label: 'Differentiation', type: 'textarea', placeholder: 'Why Domo over alternatives?' },
    ],
  },
  'partner': {
    fields: [
      { id: 'partner-name', label: 'Partner Name', type: 'text', placeholder: 'SI / Partner name...' },
      { id: 'partner-role', label: 'Partner Role', type: 'select', options: ['Implementation', 'Reseller', 'Referral', 'None'] },
      { id: 'commitment-level', label: 'Commitment Level', type: 'select', options: ['Contracted', 'Committed', 'Interested', 'Unknown'] },
    ],
  },
  'ai-strategy': {
    fields: [
      { id: 'ai-use-cases', label: 'AI/ML Use Cases', type: 'textarea', placeholder: 'Planned AI/ML use cases...' },
      { id: 'data-science-needs', label: 'Data Science Needs', type: 'select', options: ['Advanced', 'Moderate', 'Basic', 'None'] },
      { id: 'ai-readiness', label: 'AI Readiness', type: 'select', options: ['Ready', 'Preparing', 'Exploring', 'Not Applicable'] },
    ],
  },
  'risk': {
    fields: [
      { id: 'technical-risks', label: 'Technical Risks', type: 'textarea', placeholder: 'Key technical risks and concerns...' },
      { id: 'mitigations', label: 'Mitigations', type: 'textarea', placeholder: 'How will risks be mitigated?' },
      { id: 'risk-level', label: 'Overall Risk Level', type: 'select', options: ['Low', 'Medium', 'High'] },
    ],
  },
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
}: TDRInputsProps) {
  // Track local field values for controlled inputs
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  // Track which fields have been touched (for save indicators)
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  // Track fields that are dirty (changed locally but not yet saved to Snowflake)
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  // Debounce timer for auto-save
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether we recovered drafts from sessionStorage this mount
  const [recoveredDrafts, setRecoveredDrafts] = useState(false);

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
      setLocalValues(prev => ({ ...prev, ...drafts }));

      // Mark all recovered fields as dirty so they get auto-saved
      for (const key of Object.keys(drafts)) {
        dirtyFieldsRef.current.add(key);
      }
      setRecoveredDrafts(true);
    }
  }, [sessionId]);

  // ── Auto-save recovered drafts to Snowflake ────────────────────────
  useEffect(() => {
    if (!recoveredDrafts || !onSaveInput || !sessionId || !allSteps) return;

    // Flush all recovered dirty fields to Snowflake
    const flushRecovered = async () => {
      const dirty = Array.from(dirtyFieldsRef.current);
      if (dirty.length === 0) return;

      console.log(`[TDRInputs] Auto-saving ${dirty.length} recovered draft(s) to Snowflake...`);
      for (const key of dirty) {
        const [stepId, fieldId] = key.split('::');
        if (!stepId || !fieldId) continue;

        const value = localValues[key];
        if (!value) continue;

        const stepConfig = stepInputConfigs[stepId];
        const fieldConfig = stepConfig?.fields.find(f => f.id === fieldId);
        const stepIdx = allSteps.findIndex(s => s.id === stepId);
        const step = allSteps[stepIdx];

        try {
          await onSaveInput({
            stepId,
            stepLabel: step?.title || stepId,
            fieldId,
            fieldLabel: fieldConfig?.label || fieldId,
            fieldValue: value,
            stepOrder: stepIdx >= 0 ? stepIdx : 0,
          });
          dirtyFieldsRef.current.delete(key);
          setSavedFields(prev => new Set(prev).add(key));
        } catch (err) {
          console.error(`[TDRInputs] Failed to auto-save recovered draft ${key}:`, err);
        }
      }

      // Clear drafts from sessionStorage if all saved
      if (dirtyFieldsRef.current.size === 0) {
        clearDraftFromStorage(sessionId);
        setRecoveredDrafts(false);
      }
    };

    flushRecovered();
  }, [recoveredDrafts, onSaveInput, sessionId, allSteps, localValues]);

  // ── Flush dirty fields to Snowflake (called by debounce timer) ─────
  const flushDirtyFields = useCallback(async () => {
    if (!onSaveInput || !allSteps) return;

    const dirty = Array.from(dirtyFieldsRef.current);
    if (dirty.length === 0) return;

    for (const key of dirty) {
      const [stepId, fieldId] = key.split('::');
      if (!stepId || !fieldId) continue;

      // Read from current local state via the ref-safe pattern
      const value = localValues[key];
      if (value === undefined) continue;

      const stepConfig = stepInputConfigs[stepId];
      const fieldConfig = stepConfig?.fields.find(f => f.id === fieldId);
      const stepIdx = allSteps.findIndex(s => s.id === stepId);
      const step = allSteps[stepIdx];

      try {
        await onSaveInput({
          stepId,
          stepLabel: step?.title || stepId,
          fieldId,
          fieldLabel: fieldConfig?.label || fieldId,
          fieldValue: value,
          stepOrder: stepIdx >= 0 ? stepIdx : 0,
        });
        dirtyFieldsRef.current.delete(key);
        setSavedFields(prev => new Set(prev).add(key));
        console.log(`[TDRInputs] Auto-saved: ${key}`);
      } catch (err) {
        console.error(`[TDRInputs] Auto-save failed for ${key}:`, err);
      }
    }

    // Clear drafts from sessionStorage if all dirty fields flushed
    if (sessionId && dirtyFieldsRef.current.size === 0) {
      clearDraftFromStorage(sessionId);
    }
  }, [onSaveInput, allSteps, localValues, sessionId]);

  // ── Cleanup timer on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

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

      {recoveredDrafts && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/20">
          <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Unsaved inputs recovered from your last session. Auto-saving to Snowflake...
          </span>
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
                {isSaved && (
                  <span className="flex items-center gap-0.5 text-2xs text-emerald-600">
                    <Check className="h-2.5 w-2.5" />
                    saved
                  </span>
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
                <Textarea
                  id={field.id}
                  placeholder={field.placeholder}
                  className="min-h-20 resize-none text-sm"
                  value={currentValue}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  onBlur={() => handleBlur(field.id, field.label)}
                />
              )}
              {field.type === 'select' && (
                <Select
                  value={currentValue || undefined}
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
