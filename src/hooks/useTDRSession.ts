/**
 * useTDRSession — manages the lifecycle of a TDR session for a single deal.
 *
 * Responsibilities:
 *   1. On mount, check Snowflake (or localStorage) for an existing active session
 *   2. If none exists, auto-create one
 *   3. Provide `saveInput()` to persist field values on blur
 *   4. Provide `markStepComplete()` / `markStepIncomplete()` to track progress
 *   5. Load previously-saved inputs when revisiting a session
 *   6. Provide `completeSession()` to finalize
 *   7. Provide `switchToSession()` to view prior iterations (Sprint 34)
 *   8. Provide `startNewIteration()` with server-fetched prior inputs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Deal } from '@/types/tdr';
import { snowflakeStore, parseCompletedSteps } from '@/lib/snowflakeStore';
import type { SnowflakeSession, StepInput, SaveStepInputArgs } from '@/lib/snowflakeStore';
import { getAppSettings } from '@/lib/appSettings';
import { cortexAi } from '@/lib/cortexAi';
import { useDomoUser } from '@/hooks/useDomoUser';

export interface UseTDRSessionReturn {
  /** The active session (null while loading or if creation failed) */
  session: SnowflakeSession | null;
  /** Whether the session is being loaded/created */
  isLoading: boolean;
  /** Error message if session creation/load failed */
  error: string | null;
  /** Map of `stepId::fieldId` → latest value */
  inputValues: Map<string, string>;
  /** Prior iteration inputs (available after startNewIteration) */
  priorInputValues: Map<string, string>;
  /** All loaded input records (for history, etc.) */
  inputs: StepInput[];
  /** Set of completed step IDs */
  completedSteps: Set<string>;
  /** Save a single field value (call on blur / change) */
  saveInput: (args: {
    stepId: string;
    stepLabel: string;
    fieldId: string;
    fieldLabel: string;
    fieldValue: string;
    stepOrder: number;
  }) => Promise<void>;
  /** Mark a step as complete */
  markStepComplete: (stepId: string) => Promise<void>;
  /** Mark a step as incomplete */
  markStepIncomplete: (stepId: string) => Promise<void>;
  /** Complete the entire session */
  completeSession: () => Promise<void>;
  /** Whether an input is currently being saved */
  isSaving: boolean;
  /** All sessions for this deal (completed + in-progress) */
  previousSessions: SnowflakeSession[];
  /** Start a new TDR iteration for this deal */
  startNewIteration: () => Promise<void>;
  /** Switch to a different session (for viewing prior iterations) */
  switchToSession: (sessionId: string) => Promise<void>;
  /** Whether the current session is read-only (completed) */
  isReadOnly: boolean;
}

export function useTDRSession(deal: Deal | null): UseTDRSessionReturn {
  const { user } = useDomoUser();
  const userName = user.displayName;

  const [session, setSession] = useState<SnowflakeSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<StepInput[]>([]);
  const [inputValues, setInputValues] = useState<Map<string, string>>(new Map());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Track which deal we're loaded for (prevent double-creation)
  const loadedForDealRef = useRef<string | null>(null);

  // ─── Load inputs for a given session ─────────────────────────────────
  const loadSessionInputs = useCallback(async (sessionId: string) => {
    try {
      const existingInputs = await snowflakeStore.getLatestInputs(sessionId);
      setInputs(existingInputs);
      const valueMap = new Map<string, string>();
      for (const input of existingInputs) {
        valueMap.set(`${input.stepId}::${input.fieldId}`, input.fieldValue);
      }
      setInputValues(valueMap);
      console.log(`[useTDRSession] Loaded ${existingInputs.length} inputs for session ${sessionId}`);
      return valueMap;
    } catch (inputErr) {
      console.warn('[useTDRSession] Failed to load inputs:', inputErr);
      return new Map<string, string>();
    }
  }, []);

  // ─── Initialize session on mount ─────────────────────────────────────
  useEffect(() => {
    if (!deal) {
      setIsLoading(false);
      return;
    }

    if (loadedForDealRef.current === deal.id) return;
    loadedForDealRef.current = deal.id;

    const initSession = async () => {
      setIsLoading(true);
      setError(null);

      const settings = getAppSettings();
      if (!settings.enableSnowflake) {
        setSession({
          sessionId: `local-${Date.now()}`,
          opportunityId: deal.id,
          opportunityName: deal.dealName,
          accountName: deal.account,
          acv: deal.acv,
          stage: deal.stage,
          status: 'in-progress',
          owner: deal.owner,
          createdBy: userName,
          iteration: 1,
          stepSchemaVersion: 'v1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setIsReadOnly(false);
        setIsLoading(false);
        return;
      }

      try {
        console.log(`[useTDRSession] Looking for active session for deal ${deal.id}...`);
        const existingSessions = await snowflakeStore.getSessionsByOpp(deal.id);
        const activeSession = existingSessions.find(s => s.status === 'in-progress');

        if (activeSession) {
          console.log(`[useTDRSession] Found active session: ${activeSession.sessionId}`);
          setSession(activeSession);
          setIsReadOnly(false);
          setCompletedSteps(new Set(parseCompletedSteps(activeSession.completedSteps)));
          await loadSessionInputs(activeSession.sessionId);
        } else {
          console.log(`[useTDRSession] No active session — creating new one for ${deal.account}`);
          const newSession = await snowflakeStore.createSession({
            opportunityId: deal.id,
            opportunityName: deal.dealName,
            accountName: deal.account,
            acv: deal.acv,
            stage: deal.stage,
            status: 'in-progress',
            owner: deal.owner,
            createdBy: userName,
          });
          console.log(`[useTDRSession] Created session: ${newSession.sessionId} (iteration ${newSession.iteration})`);
          setSession(newSession);
          setIsReadOnly(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useTDRSession] Session init failed:', msg);
        setError(msg);
        setSession({
          sessionId: `fallback-${Date.now()}`,
          opportunityId: deal.id,
          opportunityName: deal.dealName,
          accountName: deal.account,
          acv: deal.acv,
          stage: deal.stage,
          status: 'in-progress',
          owner: deal.owner,
          createdBy: userName,
          iteration: 0,
          stepSchemaVersion: 'v1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setIsReadOnly(false);
      }

      setIsLoading(false);
    };

    initSession();
  }, [deal, loadSessionInputs]);

  // ─── Save a field value ──────────────────────────────────────────────
  const saveInput = useCallback(
    async (args: {
      stepId: string;
      stepLabel: string;
      fieldId: string;
      fieldLabel: string;
      fieldValue: string;
      stepOrder: number;
    }) => {
      if (!session || !deal || isReadOnly) return;

      if (!args.fieldValue.trim()) return;

      const key = `${args.stepId}::${args.fieldId}`;
      const currentValue = inputValues.get(key);
      if (currentValue === args.fieldValue) return;

      setIsSaving(true);
      try {
        const saveArgs: SaveStepInputArgs = {
          sessionId: session.sessionId,
          opportunityId: deal.id,
          stepId: args.stepId,
          stepLabel: args.stepLabel,
          fieldId: args.fieldId,
          fieldLabel: args.fieldLabel,
          fieldValue: args.fieldValue,
          stepOrder: args.stepOrder,
          savedBy: userName,
        };

        const savedInput = await snowflakeStore.saveStepInput(saveArgs);
        console.log(`[useTDRSession] Saved input: ${args.stepId}/${args.fieldId}`);

        setInputValues(prev => {
          const next = new Map(prev);
          next.set(key, args.fieldValue);
          return next;
        });

        setInputs(prev => {
          const filtered = prev.filter(
            i => !(i.stepId === args.stepId && i.fieldId === args.fieldId)
          );
          return [...filtered, savedInput];
        });
      } catch (err) {
        console.error('[useTDRSession] Failed to save input:', err);
        setIsSaving(false);
        throw err;
      }
      setIsSaving(false);
    },
    [session, deal, inputValues, isReadOnly]
  );

  // ─── Mark step complete/incomplete ───────────────────────────────────
  const markStepComplete = useCallback(
    async (stepId: string) => {
      if (!session || isReadOnly) return;

      const newCompleted = new Set(completedSteps);
      newCompleted.add(stepId);
      setCompletedSteps(newCompleted);

      try {
        await snowflakeStore.updateSession(session.sessionId, {
          completedSteps: Array.from(newCompleted),
        });
      } catch (err) {
        console.error('[useTDRSession] Failed to update completed steps:', err);
      }
    },
    [session, completedSteps, isReadOnly]
  );

  const markStepIncomplete = useCallback(
    async (stepId: string) => {
      if (!session || isReadOnly) return;

      const newCompleted = new Set(completedSteps);
      newCompleted.delete(stepId);
      setCompletedSteps(newCompleted);

      try {
        await snowflakeStore.updateSession(session.sessionId, {
          completedSteps: Array.from(newCompleted),
        });
      } catch (err) {
        console.error('[useTDRSession] Failed to update completed steps:', err);
      }
    },
    [session, completedSteps, isReadOnly]
  );

  // ─── Complete session ────────────────────────────────────────────────
  const completeSession = useCallback(async () => {
    if (!session || isReadOnly) return;

    try {
      const updated = await snowflakeStore.updateSession(session.sessionId, {
        status: 'completed',
      });
      if (updated) {
        setSession(updated);
        setIsReadOnly(true);
      }

      console.log('[useTDRSession] Triggering structured extraction for completed session:', session.sessionId);
      cortexAi.extractStructuredTDR(session.sessionId)
        .then(result => {
          if (result.success) {
            console.log('[useTDRSession] Structured extraction complete:', result.extractId);
          } else {
            console.warn('[useTDRSession] Structured extraction failed:', result.error);
          }
        })
        .catch(err => {
          console.warn('[useTDRSession] Structured extraction error:', err);
        });
    } catch (err) {
      console.error('[useTDRSession] Failed to complete session:', err);
    }
  }, [session, isReadOnly]);

  // ── All sessions for this deal ──
  const [previousSessions, setPreviousSessions] = useState<SnowflakeSession[]>([]);

  useEffect(() => {
    if (!deal?.id) return;
    snowflakeStore.getSessionsByOpp(deal.id)
      .then(sessions => {
        setPreviousSessions(sessions);
      })
      .catch(() => {});
  }, [deal?.id, session?.sessionId]);

  // Prior iteration inputs
  const [priorInputValues, setPriorInputValues] = useState<Map<string, string>>(new Map());

  // ── Switch to a different session (Sprint 34) ──
  const switchToSession = useCallback(async (targetSessionId: string) => {
    if (!deal) return;

    const target = previousSessions.find(s => s.sessionId === targetSessionId);
    if (!target) {
      console.warn(`[useTDRSession] Session ${targetSessionId} not found in previousSessions`);
      return;
    }

    setIsLoading(true);
    try {
      setSession(target);
      setIsReadOnly(target.status === 'completed');
      setCompletedSteps(new Set(parseCompletedSteps(target.completedSteps)));
      await loadSessionInputs(target.sessionId);
      console.log(`[useTDRSession] Switched to session ${target.sessionId} (iteration ${target.iteration}, ${target.status})`);
    } catch (err) {
      console.error('[useTDRSession] Failed to switch session:', err);
    }
    setIsLoading(false);
  }, [deal, previousSessions, loadSessionInputs]);

  // ── Start new iteration (Sprint 34: fetch prior inputs from server) ──
  const startNewIteration = useCallback(async () => {
    if (!deal || !session) return;
    try {
      // Fetch prior inputs from Snowflake (survives page reload, unlike in-memory)
      const priorValues = await loadSessionInputs(session.sessionId);
      setPriorInputValues(priorValues);

      if (session.status === 'in-progress') {
        await snowflakeStore.updateSession(session.sessionId, { status: 'completed' });
      }

      const maxIter = Math.max(
        session.iteration ?? 1,
        ...previousSessions.map(s => s.iteration ?? 1)
      );

      const newSession = await snowflakeStore.createSession({
        opportunityId: deal.id,
        opportunityName: deal.dealName,
        accountName: deal.account,
        acv: deal.acv,
        stage: deal.stage,
        status: 'in-progress',
        owner: deal.owner,
        createdBy: userName,
      });

      if (newSession) {
        (newSession as { iteration: number }).iteration = maxIter + 1;
      }

      setSession(newSession);
      setIsReadOnly(false);
      setInputValues(new Map());
      setInputs([]);
      setCompletedSteps(new Set());
      setPreviousSessions(prev => [...prev, session]);
      console.log(`[useTDRSession] New iteration ${maxIter + 1} started with ${priorValues.size} prior input(s) available`);
    } catch (err) {
      console.error('[useTDRSession] Failed to start new iteration:', err);
    }
  }, [deal, session, previousSessions, loadSessionInputs]);

  return {
    session,
    isLoading,
    error,
    inputValues,
    priorInputValues,
    inputs,
    completedSteps,
    saveInput,
    markStepComplete,
    markStepIncomplete,
    completeSession,
    isSaving,
    previousSessions,
    startNewIteration,
    switchToSession,
    isReadOnly,
  };
}
