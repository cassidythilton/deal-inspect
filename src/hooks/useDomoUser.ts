/**
 * useDomoUser — fetches the current Domo user's identity on app init.
 *
 * Strategy: read domo.env.userId for the ID, then call
 * /domo/environment/v1/ to get authenticated user details.
 * Falls back gracefully in local dev or if the API is unavailable.
 *
 * Sprint 35: User Identity Capture
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { isDomoEnvironment } from '@/lib/domo';

export interface DomoUser {
  id: string;
  displayName: string;
  emailAddress?: string;
  avatarKey?: string;
}

const FALLBACK_USER: DomoUser = {
  id: 'local-dev',
  displayName: 'Local User',
};

interface DomoUserContext {
  user: DomoUser;
  isLoading: boolean;
}

const DomoUserCtx = createContext<DomoUserContext>({
  user: FALLBACK_USER,
  isLoading: true,
});

export function useDomoUser(): DomoUserContext {
  return useContext(DomoUserCtx);
}

export { DomoUserCtx, FALLBACK_USER };

interface DomoSDKEnv {
  userId?: string | number;
  customer?: string;
  userName?: string;
  [key: string]: unknown;
}

interface DomoSDK {
  env?: DomoSDKEnv;
  get: (url: string) => Promise<unknown>;
}

export function useDomoUserInit(): DomoUserContext {
  const [user, setUser] = useState<DomoUser>(FALLBACK_USER);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isDomoEnvironment()) {
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      const domo = (window as unknown as { domo: DomoSDK }).domo;

      // Strategy 1: domo.env properties (fastest, no network call)
      if (domo.env?.userId) {
        const envUser: DomoUser = {
          id: String(domo.env.userId),
          displayName: String(domo.env.userName || domo.env.userId),
        };
        console.log(`[DomoUser] From env: ${envUser.displayName} (${envUser.id})`);
        setUser(envUser);

        // Strategy 2: enrich from /domo/environment/v1/ (authenticated, non-blocking)
        try {
          const envResult = await domo.get('/domo/environment/v1/') as Record<string, unknown>;
          if (envResult) {
            const enriched: DomoUser = {
              id: String(envResult.userId || envUser.id),
              displayName: String(envResult.userName || envResult.displayName || envUser.displayName),
              emailAddress: envResult.emailAddress ? String(envResult.emailAddress) : undefined,
            };
            setUser(enriched);
            console.log(`[DomoUser] Enriched: ${enriched.displayName} (${enriched.id})`);
          }
        } catch {
          // env properties already captured — enrichment failure is non-fatal
        }

        setIsLoading(false);
        return;
      }

      // Strategy 3: direct API call (fallback if domo.env is empty)
      try {
        const result = await domo.get('/domo/environment/v1/') as Record<string, unknown>;
        setUser({
          id: String(result.userId || 'unknown'),
          displayName: String(result.userName || result.displayName || 'Unknown User'),
          emailAddress: result.emailAddress ? String(result.emailAddress) : undefined,
        });
        console.log(`[DomoUser] From API: ${result.userName || result.displayName}`);
      } catch (err) {
        console.warn('[DomoUser] All identity strategies failed, using fallback:', err);
      }
      setIsLoading(false);
    };

    fetchUser();
  }, []);

  return { user, isLoading };
}
