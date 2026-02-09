/**
 * Settings Page
 *
 * Matches the original backup layout:
 *   1. Manager Filter — textarea + badge preview
 *   2. TDR Eligibility — min ACV input
 *   3. Default Filters — "Default to Current Quarter" switch
 *   4. Features — AI Recommendations + AppDB Persistence switches
 *   5. Excluded Forecast Categories — badge list (read-only)
 *
 * Persists via localStorage through appSettings helpers.
 */

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Users,
  DollarSign,
  Filter,
  Sparkles,
  RotateCcw,
  Save,
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

export default function Settings() {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>(getAppSettings);
  const [managerText, setManagerText] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Sync manager text on mount
  useEffect(() => {
    setManagerText(settings.allowedManagers.join('\n'));
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

  const handleSave = () => {
    const patch: Partial<AppSettings> = {
      ...settings,
      allowedManagers: parsedManagers,
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
                  <Label>AppDB Persistence</Label>
                  <p className="text-xs text-muted-foreground">
                    Save TDR sessions and agenda items to Domo AppDB.
                  </p>
                </div>
                <Switch
                  checked={settings.enableAppDB}
                  onCheckedChange={(v) => updateSetting('enableAppDB', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Snowflake Persistence</Label>
                  <p className="text-xs text-muted-foreground">
                    Use Snowflake (via Code Engine) as primary TDR data store. Falls back to AppDB if unavailable.
                  </p>
                </div>
                <Switch
                  checked={settings.enableSnowflake}
                  onCheckedChange={(v) => updateSetting('enableSnowflake', v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── 5. Excluded Forecast Categories ──────────────────────────── */}
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
