/**
 * Settings Page
 *
 * Matches the original backup layout:
 *   1. Manager Filter — textarea + badge preview
 *   2. TDR Eligibility — min ACV input
 *   3. Default Filters — "Default to Current Quarter" switch
 *   4. Features — AI Recommendations + Snowflake Persistence switches
 *   5. Excluded Forecast Categories — badge list (read-only)
 *
 * Persists via localStorage through appSettings helpers.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Users,
  DollarSign,
  Filter,
  Sparkles,
  RotateCcw,
  Save,
  Search,
  Activity,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Database,
  BookOpen,
  Plus,
  X,
  FolderSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import {
  getAppSettings,
  saveAppSettings,
  resetAppSettings,
  parseManagerList,
  AppSettings,
  DEFAULT_APP_SETTINGS,
} from '@/lib/appSettings';
import { accountIntel } from '@/lib/accountIntel';
import { SumbleIcon } from '@/components/icons/SumbleIcon';
import { PerplexityIcon } from '@/components/icons/PerplexityIcon';
import { filesetIntel } from '@/lib/filesetIntel';
import type { FilesetMetadata } from '@/lib/filesetIntel';

export default function Settings() {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);
  const [managerText, setManagerText] = useState('');
  const [competitorsText, setCompetitorsText] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // ── Fileset Configuration (Sprint 19) ──
  const [newFilesetId, setNewFilesetId] = useState('');
  const [filesetMeta, setFilesetMeta] = useState<FilesetMetadata[]>([]);
  const [filesetLoading, setFilesetLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [availableFilesets, setAvailableFilesets] = useState<FilesetMetadata[]>([]);

  // ── Account Intelligence Usage ──
  const [usageStats, setUsageStats] = useState<Record<string, unknown> | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const loadUsageStats = useCallback(async () => {
    setUsageLoading(true);
    try {
      const stats = await accountIntel.getUsageStats();
      setUsageStats(stats);
    } catch (err) {
      console.warn('[Settings] Failed to load usage stats:', err);
    }
    setUsageLoading(false);
  }, []);

  // Load fileset metadata
  const loadFilesetMeta = useCallback(async () => {
    if ((settings.filesetIds ?? []).length === 0) {
      setFilesetMeta([]);
      return;
    }
    setFilesetLoading(true);
    try {
      const metas = await filesetIntel.getConfiguredFilesets();
      setFilesetMeta(metas);
    } catch (err) {
      console.warn('[Settings] Failed to load fileset metadata:', err);
    }
    setFilesetLoading(false);
  }, [settings.filesetIds]);

  // Sync manager text + competitors text on mount + load usage stats
  useEffect(() => {
    setManagerText(settings.allowedManagers.join('\n'));
    setCompetitorsText((settings.dangerousCompetitors ?? []).join('\n'));
    loadUsageStats();
    loadFilesetMeta();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const parsedManagers = parseManagerList(managerText);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleManagerTextChange = (text: string) => {
    setManagerText(text);
    setIsDirty(true);
  };

  const parsedCompetitors = parseManagerList(competitorsText); // reuse the same line parser

  const handleAddFileset = () => {
    const id = newFilesetId.trim();
    if (!id) return;
    const current = settings.filesetIds ?? [];
    if (current.includes(id)) {
      toast('Duplicate', { description: 'This fileset ID is already configured.' });
      return;
    }
    updateSetting('filesetIds', [...current, id]);
    setNewFilesetId('');
    setIsDirty(true);
  };

  const handleRemoveFileset = (idToRemove: string) => {
    const current = settings.filesetIds ?? [];
    updateSetting('filesetIds', current.filter((id) => id !== idToRemove));
    setFilesetMeta((prev) => prev.filter((m) => m.id !== idToRemove));
    setIsDirty(true);
  };

  const handleDiscoverFilesets = async () => {
    setDiscoverLoading(true);
    try {
      const discovered = await filesetIntel.discoverFilesets();
      setAvailableFilesets(discovered);
      if (discovered.length === 0) {
        toast('No Filesets Found', { description: 'No filesets were discovered in this Domo instance.' });
      }
    } catch (err) {
      console.warn('[Settings] Failed to discover filesets:', err);
      toast('Discovery Failed', { description: 'Could not discover filesets. Ensure you have permissions.' });
    }
    setDiscoverLoading(false);
  };

  const handleSave = () => {
    const patch: Partial<AppSettings> = {
      ...settings,
      allowedManagers: parsedManagers,
      dangerousCompetitors: parsedCompetitors,
    };
    saveAppSettings(patch);
    setIsDirty(false);
    toast('Settings Saved', {
      description: 'Your preferences have been updated. Refresh the page to apply changes.',
    });
  };

  const handleReset = () => {
    resetAppSettings();
    const defaults = { ...DEFAULT_APP_SETTINGS };
    setSettings(defaults);
    setManagerText(defaults.allowedManagers.join('\n'));
    setCompetitorsText((defaults.dangerousCompetitors ?? []).join('\n'));
    setIsDirty(false);
    toast('Settings Reset', {
      description: 'All settings have been restored to defaults.',
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <SettingsIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Configure app behavior and filters
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!isDirty}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          {/* ── 1. Manager Filter ────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Manager Filter</CardTitle>
              </div>
              <CardDescription>
                Control which managers appear in the filter dropdown. Leave empty to show all managers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="managers">Allowed Managers (one per line)</Label>
                <Textarea
                  id="managers"
                  placeholder={`Andrew Rich\nJordan Kohler\nDave Scott`}
                  value={managerText}
                  onChange={(e) => handleManagerTextChange(e.target.value)}
                  className="min-h-32 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {parsedManagers.length === 0
                    ? 'All managers will be shown (no filter applied)'
                    : `${parsedManagers.length} managers configured`}
                </p>
              </div>

              {parsedManagers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parsedManagers.map((mgr, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {mgr}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 2. TDR Eligibility ───────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <CardTitle>TDR Eligibility</CardTitle>
              </div>
              <CardDescription>
                Configure which deals are eligible for Technical Deal Reviews.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="minACV">Minimum ACV Threshold (USD)</Label>
                <Input
                  id="minACV"
                  type="number"
                  value={settings.minTDRACV}
                  onChange={(e) =>
                    updateSetting('minTDRACV', parseInt(e.target.value) || 0)
                  }
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Only deals with ACV ≥ ${settings.minTDRACV.toLocaleString()} will be shown as TDR
                  candidates.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── 3. Default Filters ───────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Default Filters</CardTitle>
              </div>
              <CardDescription>
                Configure default filter behavior when the app loads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Default to Current Quarter</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically filter to the current fiscal quarter on load.
                  </p>
                </div>
                <Switch
                  checked={settings.defaultQuarterFilter === 'current'}
                  onCheckedChange={(checked) =>
                    updateSetting('defaultQuarterFilter', checked ? 'current' : 'all')
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* ── 4. Features ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Features</CardTitle>
              </div>
              <CardDescription>Enable or disable app features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AI Recommendations</Label>
                  <p className="text-xs text-muted-foreground">
                    Use Domo AI to generate TDR candidate recommendations.
                  </p>
                </div>
                <Switch
                  checked={settings.enableAIRecommendations}
                  onCheckedChange={(v) => updateSetting('enableAIRecommendations', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Snowflake Persistence</Label>
                  <p className="text-xs text-muted-foreground">
                    Use Snowflake (via Code Engine) as the TDR data store. All sessions, inputs, and intelligence are persisted in Snowflake.
                  </p>
                </div>
                <Switch
                  checked={settings.enableSnowflake}
                  onCheckedChange={(v) => updateSetting('enableSnowflake', v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── 5. Dangerous Competitors (Sprint 18) ────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Dangerous Competitors</CardTitle>
              </div>
              <CardDescription>
                Competitors that trigger elevated TDR scoring. When a deal names one of these
                competitors, the Post-TDR Score increases to signal competitive urgency.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="competitors">Tracked Competitors (one per line)</Label>
                <Textarea
                  id="competitors"
                  placeholder={`Sigma Computing\nFivetran\ndbt\nTableau`}
                  value={competitorsText}
                  onChange={(e) => {
                    setCompetitorsText(e.target.value);
                    setIsDirty(true);
                  }}
                  className="min-h-28 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {parsedCompetitors.length === 0
                    ? 'No dangerous competitors configured'
                    : `${parsedCompetitors.length} competitors tracked`}
                </p>
              </div>

              {parsedCompetitors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parsedCompetitors.map((comp, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">
                      {comp}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 6. Knowledge Base Filesets (Sprint 19) ─────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Knowledge Base Filesets</CardTitle>
              </div>
              <CardDescription>
                Configure Domo filesets containing partner playbooks, competitive battle cards,
                and other reference documents. These are searched automatically during TDR sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add fileset input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter fileset ID (e.g. 6d0776f7-cafe-47c0-...)"
                  value={newFilesetId}
                  onChange={(e) => setNewFilesetId(e.target.value)}
                  className="flex-1 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFileset();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFileset}
                  disabled={!newFilesetId.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Discover button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleDiscoverFilesets}
                disabled={discoverLoading}
              >
                {discoverLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderSearch className="h-4 w-4" />
                )}
                Discover Available Filesets
              </Button>

              {/* Discovered filesets */}
              {availableFilesets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Available Filesets:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                    {availableFilesets.map((fs) => {
                      const isConfigured = (settings.filesetIds ?? []).includes(fs.id);
                      return (
                        <div
                          key={fs.id}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{fs.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{fs.id}</p>
                          </div>
                          {isConfigured ? (
                            <Badge variant="secondary" className="text-xs shrink-0 ml-2">Added</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 ml-2"
                              onClick={() => {
                                updateSetting('filesetIds', [...(settings.filesetIds ?? []), fs.id]);
                                setIsDirty(true);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Configured filesets */}
              {(settings.filesetIds ?? []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Configured ({(settings.filesetIds ?? []).length}):
                  </p>
                  <div className="space-y-1.5">
                    {(settings.filesetIds ?? []).map((id) => {
                      const meta = filesetMeta.find((m) => m.id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {meta?.name || `Fileset ${id.substring(0, 8)}...`}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{id}</p>
                            {meta?.fileCount !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                {meta.fileCount} files
                                {meta.lastUpdated ? ` · Updated ${new Date(meta.lastUpdated).toLocaleDateString()}` : ''}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 ml-2 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveFileset(id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No filesets configured. Add a fileset ID or use Discover to find available filesets.
                </p>
              )}

              <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Filesets are searched automatically when opening a TDR. Results appear in the
                  Intelligence panel and can be included in chat context.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── 7. Account Intelligence ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Account Intelligence</CardTitle>
              </div>
              <CardDescription>
                API usage for Sumble (technographics) and Perplexity (web research).
                All API calls are user-initiated — no automatic fetching.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usageLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading usage statistics…
                </div>
              ) : usageStats ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Sumble Stats */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <SumbleIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">Sumble</span>
                    </div>
                    {(() => {
                      const s = usageStats.sumble as { calls?: number; errors?: number; avgDurationMs?: number } | undefined;
                      return s ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Calls this month</span>
                            <span className="font-medium tabular-nums">{s.calls ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Errors</span>
                            <span className={`font-medium tabular-nums ${(s.errors ?? 0) > 0 ? 'text-red-500' : ''}`}>
                              {s.errors ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Avg. response</span>
                            <span className="font-medium tabular-nums text-muted-foreground">
                              {s.avgDurationMs ? `${(s.avgDurationMs / 1000).toFixed(1)}s` : '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No calls recorded</p>
                      );
                    })()}
                  </div>

                  {/* Perplexity Stats */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <PerplexityIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">Perplexity</span>
                    </div>
                    {(() => {
                      const p = usageStats.perplexity as { calls?: number; errors?: number; avgDurationMs?: number } | undefined;
                      return p ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Calls this month</span>
                            <span className="font-medium tabular-nums">{p.calls ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Errors</span>
                            <span className={`font-medium tabular-nums ${(p.errors ?? 0) > 0 ? 'text-red-500' : ''}`}>
                              {p.errors ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Avg. response</span>
                            <span className="font-medium tabular-nums text-muted-foreground">
                              {p.avgDurationMs ? `${(p.avgDurationMs / 1000).toFixed(1)}s` : '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No calls recorded</p>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Usage statistics are only available when connected to Domo.
                </p>
              )}
              <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Month: <strong>{(usageStats?.month as string) || new Date().toISOString().substring(0, 7)}</strong>.
                  Both Sumble and Perplexity are called on-demand only — click "Enrich" or "Research" in the TDR workspace.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* ── 6. Excluded Forecast Categories ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Excluded Forecast Categories</CardTitle>
              <CardDescription>
                These categories are filtered out from the deal tables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {settings.excludedForecastCategories.map((cat, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                To modify excluded categories, update the appSettings.ts configuration file.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
