import { useState, useCallback } from 'react';
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
import { Check, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TDRInputsProps {
  activeStep: TDRStep | undefined;
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

export function TDRInputs({
  activeStep,
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

  // Handle local change (controlled input)
  const handleChange = (fieldId: string, value: string) => {
    const key = `${activeStep.id}::${fieldId}`;
    setLocalValues(prev => ({ ...prev, [key]: value }));
    // Clear saved indicator when editing
    setSavedFields(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Handle blur — persist to Snowflake
  const handleBlur = async (fieldId: string, fieldLabel: string) => {
    if (!onSaveInput || !activeStep) return;

    const key = `${activeStep.id}::${fieldId}`;
    const value = localValues[key];
    if (value === undefined) return; // Nothing was changed locally

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
    </div>
  );
}
