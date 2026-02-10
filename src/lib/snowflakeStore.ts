/**
 * Snowflake Store — Front-end service for TDR persistence via Code Engine.
 *
 * The single persistence layer since Sprint 12 (AppDB retired). All operations
 * route through Domo Code Engine → Snowflake SQL API.
 *
 * In dev mode (no Domo SDK), falls back to localStorage (same pattern as appDb.ts).
 *
 * ARCHITECTURE:
 *   snowflakeStore.createSession()  → POST /domo/codeengine/v2/packages/tdr-codeengine/createSession
 *   snowflakeStore.getAllSessions()  → POST /domo/codeengine/v2/packages/tdr-codeengine/getAllSessions
 *   etc.
 *
 * @see IMPLEMENTATION_STRATEGY.md Section 11
 */

import { isDomoEnvironment } from './domo';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Session shape stored in Snowflake (matches TDR_SESSIONS table) */
export interface SnowflakeSession {
  sessionId: string;
  opportunityId: string;
  opportunityName: string;
  accountName: string;
  acv: number;
  stage: string;
  status: 'in-progress' | 'completed';
  outcome?: 'approved' | 'needs-work' | 'deferred' | 'at-risk';
  owner: string;
  createdBy: string;
  iteration: number;
  stepSchemaVersion: string;
  notes?: string;
  completedSteps?: string[];
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a new session (sessionId is generated server-side) */
export type CreateSessionInput = Omit<SnowflakeSession, 'sessionId' | 'iteration' | 'stepSchemaVersion' | 'createdAt' | 'updatedAt'>;

/** Fields that can be updated on an existing session */
export type SessionUpdates = Partial<Pick<SnowflakeSession, 'status' | 'outcome' | 'notes' | 'completedSteps' | 'stage' | 'acv'>>;

/** Step input record from Snowflake (matches TDR_STEP_INPUTS table) */
export interface StepInput {
  inputId: string;
  sessionId: string;
  opportunityId: string;
  stepId: string;
  stepLabel?: string;
  fieldId: string;
  fieldLabel?: string;
  fieldValue: string;
  stepOrder?: number;
  savedAt: string;
  savedBy: string;
}

/** Minimum fields needed to save a step input */
export interface SaveStepInputArgs {
  sessionId: string;
  opportunityId: string;
  stepId: string;
  stepLabel?: string;
  fieldId: string;
  fieldLabel?: string;
  fieldValue: string;
  stepOrder?: number;
  savedBy: string;
}

// ─── Code Engine Calling ─────────────────────────────────────────────────────

interface DomoSDK {
  get: (url: string) => Promise<unknown>;
  post: (url: string, body?: unknown) => Promise<unknown>;
  put: (url: string, body?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}

function getDomo(): DomoSDK | null {
  const domo = (window as unknown as { domo?: DomoSDK }).domo
    || (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

const CE_BASE = '/domo/codeengine/v2/packages';

/**
 * Call a Code Engine function.
 *
 * The URL pattern is `/domo/codeengine/v2/packages/{functionAlias}`.
 * The proxyId in manifest.json tells Domo which Code Engine package to route to —
 * it is NOT part of the URL path (reference: github-appstudio-app/app.js).
 *
 * @param fnName - The function alias (e.g., 'createSession')
 * @param args   - Named arguments matching the packageMapping parameters
 * @returns      - The function's return value
 */
async function callCodeEngine<T>(fnName: string, args: Record<string, unknown> = {}): Promise<T> {
  const domo = getDomo();
  if (!domo) {
    throw new Error(`[SnowflakeStore] Code Engine not available — no Domo SDK. Function: ${fnName}`);
  }

  const url = `${CE_BASE}/${fnName}`;
  console.log(`[SnowflakeStore] Calling Code Engine: ${fnName}`, Object.keys(args));

  try {
    const result = await domo.post(url, args);
    console.log(`[SnowflakeStore] Code Engine raw response for ${fnName}:`, JSON.stringify(result));
    return result as T;
  } catch (err) {
    console.error(`[SnowflakeStore] Code Engine call failed: ${fnName}`, err);
    throw err;
  }
}

// ─── LocalStorage Fallback (Dev Mode) ────────────────────────────────────────

const LS_SESSIONS_KEY = 'tdr_snowflake_sessions';
const LS_INPUTS_KEY = 'tdr_snowflake_inputs';

function generateDevId(): string {
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Response Helpers ────────────────────────────────────────────────────────

/**
 * Defensively extract a sessions array from a Code Engine response.
 *
 * Domo SDK wraps CE return values inside { [outputAlias]: returnValue }.
 * For getAllSessions with output alias "sessions", this produces:
 *   { sessions: { success: true, sessions: [] } }
 *
 * So we may see:
 *   - Direct array: [...]
 *   - Raw CE object: { success: true, sessions: [...] }
 *   - SDK-wrapped:   { sessions: { success: true, sessions: [...] } }
 *   - SDK-wrapped with direct array: { sessions: [...] }
 */
/**
 * Safely parse completedSteps from Snowflake.
 *
 * Snowflake returns VARIANT columns as JSON strings (e.g. '["context","decision"]'),
 * not native JS arrays. If the frontend naively passes a string to `new Set(string)`,
 * JavaScript iterates over individual CHARACTERS — producing garbage.
 *
 * This helper normalizes the value to always return a clean string[].
 */
export function parseCompletedSteps(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === 'string');
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === 'string');
    } catch {
      // Malformed JSON — return empty
    }
  }
  return [];
}

/**
 * Normalize a session's completedSteps from string → array.
 */
function normalizeSession(session: SnowflakeSession): SnowflakeSession {
  return {
    ...session,
    completedSteps: parseCompletedSteps(session.completedSteps),
  };
}

function extractSessionsArray(raw: unknown): SnowflakeSession[] {
  let sessions: SnowflakeSession[] = [];

  if (Array.isArray(raw)) {
    sessions = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    // Direct .sessions as array (e.g. raw CE response or SDK alias)
    if (Array.isArray(obj.sessions)) {
      sessions = obj.sessions as SnowflakeSession[];
    }
    // SDK-wrapped: { sessions: { success, sessions: [...] } }
    else if (obj.sessions && typeof obj.sessions === 'object' && !Array.isArray(obj.sessions)) {
      const inner = obj.sessions as Record<string, unknown>;
      if (Array.isArray(inner.sessions)) sessions = inner.sessions as SnowflakeSession[];
      else if (Array.isArray(inner.data)) sessions = inner.data as SnowflakeSession[];
    }
    // Other fallbacks
    else if (Array.isArray(obj.data)) sessions = obj.data as SnowflakeSession[];
    else if (Array.isArray(obj.items)) sessions = obj.items as SnowflakeSession[];
    else if (Array.isArray(obj.output)) sessions = obj.output as SnowflakeSession[];
  }

  if (sessions.length === 0 && raw) {
    console.warn('[SnowflakeStore] Could not extract sessions array from:', raw);
  }

  // Normalize completedSteps on every session (Snowflake returns JSON strings, not arrays)
  return sessions.map(normalizeSession);
}

/**
 * Defensively extract a result object from a Code Engine response.
 *
 * Domo SDK wraps in { [outputAlias]: returnValue }. For functions with
 * output alias "session" or "result", the shape is:
 *   { session: { success: true, session: {...} } }
 * or { result: { success: true } }
 *
 * We unwrap one level if the top-level object has a single key that
 * maps to another object (the SDK wrapper pattern).
 */
function extractResult<T>(raw: unknown): T {
  if (!raw || typeof raw !== 'object') return { success: false } as T;

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);

  // If the object already has 'success', it's the raw CE response — use as-is
  if ('success' in obj) return obj as T;

  // SDK wrapper: single-key object whose value is the actual CE response
  if (keys.length === 1) {
    const inner = obj[keys[0]];
    if (inner && typeof inner === 'object') return inner as T;
  }

  return obj as T;
}

// ─── Snowflake Store Service ─────────────────────────────────────────────────

export const snowflakeStore = {
  // =====================================================================
  // Session CRUD
  // =====================================================================

  /**
   * Create a new TDR session in Snowflake.
   * Returns the created session with server-generated sessionId.
   */
  async createSession(input: CreateSessionInput): Promise<SnowflakeSession> {
    if (!isDomoEnvironment()) {
      // Dev mode: localStorage
      const now = new Date().toISOString();
      const session: SnowflakeSession = {
        sessionId: generateDevId(),
        ...input,
        iteration: 1,
        stepSchemaVersion: 'v1',
        createdAt: now,
        updatedAt: now,
      };
      const sessions = this._devGetSessions();
      sessions.push(session);
      localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions));
      console.log('[SnowflakeStore] Dev mode: created session', session.sessionId);
      return session;
    }

    const raw = await callCodeEngine<unknown>('createSession', { session: input });
    const result = extractResult<{ success?: boolean; session?: SnowflakeSession }>(raw);

    if (!result.success && !result.session) {
      throw new Error('[SnowflakeStore] createSession failed');
    }

    return normalizeSession(result.session!);
  },

  /**
   * Update an existing session (status, outcome, notes, completedSteps, etc.).
   */
  async updateSession(sessionId: string, updates: SessionUpdates): Promise<SnowflakeSession | null> {
    if (!isDomoEnvironment()) {
      const sessions = this._devGetSessions();
      const idx = sessions.findIndex(s => s.sessionId === sessionId);
      if (idx < 0) return null;
      const now = new Date().toISOString();
      sessions[idx] = { ...sessions[idx], ...updates, updatedAt: now };
      localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions));
      return sessions[idx];
    }

    const raw = await callCodeEngine<unknown>('updateSession', { sessionId, updates });
    const result = extractResult<{ success?: boolean; session?: SnowflakeSession; error?: string }>(raw);

    if (!result.success) {
      const errMsg = result.error || 'updateSession failed';
      console.error('[SnowflakeStore] updateSession failed:', errMsg);
      throw new Error(errMsg);
    }

    return result.session ? normalizeSession(result.session) : null;
  },

  /**
   * Get all sessions for a specific opportunity.
   * Returns newest-first.
   */
  async getSessionsByOpp(opportunityId: string): Promise<SnowflakeSession[]> {
    if (!isDomoEnvironment()) {
      return this._devGetSessions()
        .filter(s => s.opportunityId === opportunityId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    const result = await callCodeEngine<unknown>('getSessionsByOpp', { opportunityId });
    return extractSessionsArray(result);
  },

  /**
   * Get ALL sessions across all deals.
   * Used for the deals table TDR status column.
   *
   * Defensive: Domo SDK may return the raw CE response `{ success, sessions }`,
   * or the packageMapping output extraction may return just the array,
   * or wrap it differently. Handle all shapes.
   */
  async getAllSessions(): Promise<SnowflakeSession[]> {
    if (!isDomoEnvironment()) {
      return this._devGetSessions();
    }

    const result = await callCodeEngine<unknown>('getAllSessions');
    return extractSessionsArray(result);
  },

  /**
   * Delete a session (soft or hard — Code Engine decides).
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!isDomoEnvironment()) {
      const sessions = this._devGetSessions().filter(s => s.sessionId !== sessionId);
      localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions));
      return true;
    }

    const raw = await callCodeEngine<unknown>('deleteSession', { sessionId });
    const result = extractResult<{ success?: boolean }>(raw);
    return !!result.success;
  },

  /**
   * Build a lookup of opportunityId → array of sessions (newest-first).
   * This mirrors `appDb.getTDRSessionsByDeal()` for compatibility.
   */
  async getSessionsByDeal(): Promise<Map<string, SnowflakeSession[]>> {
    const sessions = await this.getAllSessions();
    const map = new Map<string, SnowflakeSession[]>();

    for (const session of sessions) {
      const oppId = session.opportunityId;
      if (!oppId) continue;
      const existing = map.get(oppId) || [];
      existing.push(session);
      map.set(oppId, existing);
    }

    // Sort each list newest-first
    for (const [, list] of map) {
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    console.log(`[SnowflakeStore] ${sessions.length} sessions across ${map.size} deals`);
    return map;
  },

  // =====================================================================
  // Step Input CRUD
  // =====================================================================

  /**
   * Save a step input value (append-only — creates a new row each time).
   */
  async saveStepInput(args: SaveStepInputArgs): Promise<StepInput> {
    if (!isDomoEnvironment()) {
      const now = new Date().toISOString();
      const input: StepInput = {
        inputId: generateDevId(),
        ...args,
        savedAt: now,
      };
      const inputs = this._devGetInputs();
      inputs.push(input);
      localStorage.setItem(LS_INPUTS_KEY, JSON.stringify(inputs));
      return input;
    }

    // Domo Code Engine validates types against manifest — stepOrder is declared as string
    const ceArgs = {
      ...args,
      stepOrder: args.stepOrder !== undefined && args.stepOrder !== null
        ? String(args.stepOrder)
        : '0',
    };
    const raw = await callCodeEngine<unknown>('saveStepInput', ceArgs);
    const result = extractResult<{ success?: boolean; input?: StepInput }>(raw);

    if (!result.success && !result.input) {
      throw new Error('[SnowflakeStore] saveStepInput failed');
    }

    return result.input!;
  },

  /**
   * Get the latest value for every field in a session.
   * Returns one row per unique (stepId, fieldId) — the most recent value.
   */
  async getLatestInputs(sessionId: string): Promise<StepInput[]> {
    if (!isDomoEnvironment()) {
      const inputs = this._devGetInputs().filter(i => i.sessionId === sessionId);
      // Deduplicate: keep latest per (stepId, fieldId)
      const latest = new Map<string, StepInput>();
      for (const input of inputs.sort((a, b) => a.savedAt.localeCompare(b.savedAt))) {
        latest.set(`${input.stepId}::${input.fieldId}`, input);
      }
      return Array.from(latest.values());
    }

    const raw = await callCodeEngine<unknown>('getLatestInputs', { sessionId });
    const result = extractResult<{ success?: boolean; inputs?: StepInput[] }>(raw);

    if (Array.isArray(result.inputs)) return result.inputs;
    if (Array.isArray(raw)) return raw as StepInput[];
    return [];
  },

  /**
   * Get the full edit history for a specific field.
   */
  async getInputHistory(sessionId: string, stepId: string, fieldId: string): Promise<StepInput[]> {
    if (!isDomoEnvironment()) {
      return this._devGetInputs().filter(
        i => i.sessionId === sessionId && i.stepId === stepId && i.fieldId === fieldId
      ).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    }

    const raw = await callCodeEngine<unknown>('getInputHistory', { sessionId, stepId, fieldId });
    const result = extractResult<{ success?: boolean; inputs?: StepInput[] }>(raw);

    if (Array.isArray(result.inputs)) return result.inputs;
    if (Array.isArray(raw)) return raw as StepInput[];
    return [];
  },

  // =====================================================================
  // Compatibility Layer (maps to AppDB TDRSession shape)
  // =====================================================================

  /**
   * Convert a SnowflakeSession to the AppDB TDRSession shape.
   * This allows the existing UI code to work without changes.
   */
  toAppDbSession(session: SnowflakeSession): {
    id: string;
    opportunityId: string;
    opportunityName: string;
    accountName: string;
    acv: number;
    stage: string;
    status: 'in-progress' | 'completed';
    owner: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    completedSteps: string[];
    notes: string;
  } {
    return {
      id: session.sessionId,
      opportunityId: session.opportunityId,
      opportunityName: session.opportunityName,
      accountName: session.accountName,
      acv: session.acv,
      stage: session.stage,
      status: session.status,
      owner: session.owner,
      createdBy: session.createdBy,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedSteps: parseCompletedSteps(session.completedSteps),
      notes: session.notes || '',
    };
  },

  // =====================================================================
  // Dev-mode helpers
  // =====================================================================

  _devGetSessions(): SnowflakeSession[] {
    const raw = localStorage.getItem(LS_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  _devGetInputs(): StepInput[] {
    const raw = localStorage.getItem(LS_INPUTS_KEY);
    return raw ? JSON.parse(raw) : [];
  },
};

