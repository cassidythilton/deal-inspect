/**
 * useDomoUser — fetches the current Domo user's identity on app init.
 *
 * In a Domo environment, calls `/domo/users/v1/me` to get the real user.
 * Outside Domo (local dev), returns a fallback identity.
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

export function useDomoUserInit(): DomoUserContext {
  const [user, setUser] = useState<DomoUser>(FALLBACK_USER);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isDomoEnvironment()) {
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const domo = (window as unknown as { domo: { get: (url: string) => Promise<unknown> } }).domo;
        const result = await domo.get('/domo/users/v1/me') as Record<string, unknown>;
        setUser({
          id: String(result.id || 'unknown'),
          displayName: String(result.displayName || result.name || 'Unknown User'),
          emailAddress: result.emailAddress ? String(result.emailAddress) : undefined,
          avatarKey: result.avatarKey ? String(result.avatarKey) : undefined,
        });
        console.log(`[DomoUser] Identified: ${result.displayName} (${result.id})`);
      } catch (err) {
        console.warn('[DomoUser] Failed to fetch user identity, using fallback:', err);
      }
      setIsLoading(false);
    };

    fetchUser();
  }, []);

  return { user, isLoading };
}
