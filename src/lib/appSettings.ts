/**
 * App Settings — localStorage-persisted application configuration.
 *
 * Matches the original backup behavior:
 *   - Reads/writes to localStorage key "tdrAppSettings"
 *   - Merges saved values over defaults so new keys are always present
 *   - Provides get / save / reset helpers
 */

export interface AppSettings {
  allowedManagers: string[];
  minTDRACV: number;
  defaultQuarterFilter: 'current' | 'all';
  includedForecastCategories: string[];
  excludedForecastCategories: string[];
  enableAIRecommendations: boolean;
  enableSnowflake: boolean;           // Use Snowflake via Code Engine for TDR persistence
  defaultManager: string;
  /** Sprint 18: Competitors that trigger elevated scoring */
  dangerousCompetitors: string[];
  /** Sprint 19: Domo fileset IDs for Knowledge Base */
  filesetIds: string[];
  /** Sprint 19: ID → display name mapping for configured filesets */
  filesetNameMap: Record<string, string>;
  /** Sprint 14: Default Slack channel for readout distribution */
  slackDefaultChannel?: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  allowedManagers: [
    'Andrew Rich',
    'John Pasalano',
    'Keith White',
    'Taylor Rust',
    'Casey Morgan',
  ],
  minTDRACV: 100000,
  defaultQuarterFilter: 'current',
  includedForecastCategories: [
    '1.C Won',
    '2.Commit',
    '3.Probable',
    '4.Upside',
    '5.Pipeline',
  ],
  excludedForecastCategories: ['6.Omitted', 'Closed Won', 'Closed Lost'],
  enableAIRecommendations: true,
  enableSnowflake: true,
  defaultManager: 'Andrew Rich',
  dangerousCompetitors: [
    'Sigma Computing',
    'Fivetran',
    'dbt',
    'Matillion',
    'Tableau',
    'Power BI',
    'Qlik',
    'Looker',
    'ThoughtSpot',
  ],
  filesetIds: [],
  filesetNameMap: {},
  slackDefaultChannel: 'tdr-channel',
};

const STORAGE_KEY = 'tdrAppSettings';

/** Read current settings (merged over defaults). */
export function getAppSettings(): AppSettings {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_APP_SETTINGS, ...parsed };
      } catch {
        // corrupted — fall through to defaults
      }
    }
  }
  return { ...DEFAULT_APP_SETTINGS };
}

/** Save settings (merges with current). */
export function saveAppSettings(patch: Partial<AppSettings>): void {
  if (typeof window !== 'undefined') {
    const current = getAppSettings();
    const merged = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
}

/** Reset to factory defaults. */
export function resetAppSettings(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Parse a newline-delimited string into a trimmed, non-empty array. */
export function parseManagerList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Returns the active manager list — Settings overrides take precedence,
 * falling back to DEFAULT_APP_SETTINGS.allowedManagers.
 */
export function getActiveManagers(): string[] {
  return getAppSettings().allowedManagers;
}

