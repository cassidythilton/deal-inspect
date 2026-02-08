/**
 * AppDB Service — Domo AppDB integration for TDR session persistence.
 *
 * Uses the Domo AppDB API (/domo/datastores/v1/collections) to store
 * TDR sessions per deal. Each session records whether a TDR has been
 * completed (or is in-progress) for a given opportunity.
 *
 * In dev mode (no Domo SDK), falls back to localStorage.
 *
 * API reference: https://developer.domo.com/portal/1l1fm2g0sfm69-app-db-api
 */

import { isDomoEnvironment } from './domo';

// ─── Collection Names ────────────────────────────────────────────────────────

const COLLECTIONS = {
  tdrSessions: 'TDRSessions',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TDRSession {
  id?: string;
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
}

interface DomoSDK {
  get: (url: string) => Promise<unknown>;
  post: (url: string, body?: unknown) => Promise<unknown>;
  put: (url: string, body?: unknown) => Promise<unknown>;
  delete: (url: string) => Promise<unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDomo(): DomoSDK | null {
  const domo = (window as unknown as { domo?: DomoSDK }).domo
    || (globalThis as unknown as { domo?: DomoSDK }).domo;
  return domo || null;
}

// ─── AppDB Service ───────────────────────────────────────────────────────────

export const appDb = {
  /**
   * Initialize the TDRSessions collection if it doesn't already exist.
   * Safe to call multiple times — 409 (conflict) is swallowed.
   */
  async initializeCollections(): Promise<{ success: boolean; errors: string[] }> {
    const domo = getDomo();
    if (!domo) {
      console.log('[AppDB] Dev mode — using localStorage');
      return { success: true, errors: [] };
    }

    const errors: string[] = [];

    try {
      await domo.post('/domo/datastores/v1/collections', {
        name: COLLECTIONS.tdrSessions,
        schema: {
          columns: [
            { name: 'opportunityId', type: 'STRING' },
            { name: 'opportunityName', type: 'STRING' },
            { name: 'accountName', type: 'STRING' },
            { name: 'acv', type: 'DOUBLE' },
            { name: 'stage', type: 'STRING' },
            { name: 'status', type: 'STRING' },
            { name: 'owner', type: 'STRING' },
            { name: 'createdBy', type: 'STRING' },
            { name: 'createdAt', type: 'STRING' },
            { name: 'updatedAt', type: 'STRING' },
            { name: 'completedSteps', type: 'STRING' },
            { name: 'notes', type: 'STRING' },
          ],
        },
        syncEnabled: true,
      });
      console.log('[AppDB] Created TDRSessions collection');
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status !== 409 && !e.message?.includes('already exists')) {
        errors.push(`TDRSessions: ${e.message}`);
      }
    }

    return { success: errors.length === 0, errors };
  },

  /**
   * Fetch all TDR sessions from AppDB.
   */
  async getTDRSessions(): Promise<TDRSession[]> {
    const domo = getDomo();

    if (!domo) {
      const raw = localStorage.getItem('tdrSessions');
      return raw ? JSON.parse(raw) : [];
    }

    try {
      const result = await domo.get(
        `/domo/datastores/v1/collections/${COLLECTIONS.tdrSessions}/documents`
      );
      const docs = (result || []) as Array<{ id: string; content: Record<string, unknown> }>;
      return docs.map((doc) => ({
        id: doc.id,
        ...(doc.content as Omit<TDRSession, 'id' | 'completedSteps'>),
        completedSteps: doc.content?.completedSteps
          ? JSON.parse(doc.content.completedSteps as string)
          : [],
      }));
    } catch (err) {
      console.error('[AppDB] Failed to fetch TDR sessions:', err);
      return [];
    }
  },

  /**
   * Save a new TDR session.
   */
  async saveTDRSession(session: Omit<TDRSession, 'id'>): Promise<TDRSession> {
    const now = new Date().toISOString();
    const payload = {
      ...session,
      createdAt: session.createdAt || now,
      updatedAt: now,
      completedSteps: JSON.stringify(session.completedSteps || []),
    };

    const domo = getDomo();

    if (!domo) {
      const sessions = await this.getTDRSessions();
      const newSession: TDRSession = { id: `dev-${Date.now()}`, ...session, updatedAt: now };
      sessions.push(newSession);
      localStorage.setItem('tdrSessions', JSON.stringify(sessions));
      return newSession;
    }

    try {
      const result = await domo.post(
        `/domo/datastores/v1/collections/${COLLECTIONS.tdrSessions}/documents`,
        { content: payload }
      ) as { id: string };
      return { id: result.id, ...session, updatedAt: now };
    } catch (err) {
      console.error('[AppDB] Failed to save TDR session:', err);
      throw err;
    }
  },

  /**
   * Update an existing TDR session by ID.
   */
  async updateTDRSession(
    id: string,
    updates: Partial<TDRSession>
  ): Promise<TDRSession | null> {
    const existing = await this.getTDRSession(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const merged: TDRSession = { ...existing, ...updates, updatedAt: now };
    const payload = {
      ...merged,
      completedSteps: JSON.stringify(merged.completedSteps || []),
    };

    const domo = getDomo();

    if (!domo) {
      const sessions = await this.getTDRSessions();
      const idx = sessions.findIndex((s) => s.id === id);
      if (idx >= 0) {
        sessions[idx] = merged;
        localStorage.setItem('tdrSessions', JSON.stringify(sessions));
      }
      return merged;
    }

    try {
      await domo.put(
        `/domo/datastores/v1/collections/${COLLECTIONS.tdrSessions}/documents/${id}`,
        { content: payload }
      );
      return merged;
    } catch (err) {
      console.error('[AppDB] Failed to update TDR session:', err);
      throw err;
    }
  },

  /**
   * Get a single TDR session by document ID.
   */
  async getTDRSession(id: string): Promise<TDRSession | null> {
    const domo = getDomo();

    if (!domo) {
      const sessions = await this.getTDRSessions();
      return sessions.find((s) => s.id === id) || null;
    }

    try {
      const doc = await domo.get(
        `/domo/datastores/v1/collections/${COLLECTIONS.tdrSessions}/documents/${id}`
      ) as { id: string; content: Record<string, unknown> } | null;
      if (!doc) return null;
      return {
        id: doc.id,
        ...(doc.content as Omit<TDRSession, 'id' | 'completedSteps'>),
        completedSteps: doc.content?.completedSteps
          ? JSON.parse(doc.content.completedSteps as string)
          : [],
      };
    } catch (err) {
      console.error('[AppDB] Failed to fetch TDR session:', err);
      return null;
    }
  },

  /**
   * Delete a TDR session by document ID.
   */
  async deleteTDRSession(id: string): Promise<boolean> {
    const domo = getDomo();

    if (!domo) {
      const sessions = (await this.getTDRSessions()).filter((s) => s.id !== id);
      localStorage.setItem('tdrSessions', JSON.stringify(sessions));
      return true;
    }

    try {
      await domo.delete(
        `/domo/datastores/v1/collections/${COLLECTIONS.tdrSessions}/documents/${id}`
      );
      return true;
    } catch (err) {
      console.error('[AppDB] Failed to delete TDR session:', err);
      return false;
    }
  },

  /**
   * Build a lookup of opportunityId → TDRSession status.
   * Returns a Map for O(1) lookups in the deals table.
   */
  async getTDRStatusMap(): Promise<Map<string, TDRSession>> {
    const sessions = await this.getTDRSessions();
    const map = new Map<string, TDRSession>();

    for (const session of sessions) {
      const oppId = session.opportunityId;
      // If multiple sessions exist for the same opp, prefer the latest
      const existing = map.get(oppId);
      if (!existing || session.updatedAt > existing.updatedAt) {
        map.set(oppId, session);
      }
    }

    console.log(`[AppDB] TDR status map: ${map.size} deals have TDR sessions`);
    return map;
  },
};

