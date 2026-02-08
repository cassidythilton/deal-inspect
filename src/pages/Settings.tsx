import { useState } from 'react';
import { Settings as SettingsIcon, Users, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ALLOWED_MANAGERS } from '@/lib/constants';

export default function Settings() {
  const [managers, setManagers] = useState<string>(ALLOWED_MANAGERS.join('\n'));
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    // In a real app, this would persist to localStorage or backend
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const managerList = managers.split('\n').filter(m => m.trim());

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Settings</span>
        </div>
      </header>
      
      <main className="flex-1 p-6 bg-background">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Manager Filter Settings */}
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Manager Filter</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Control which managers appear in the filter dropdown.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  Allowed Managers (one per line)
                </label>
                <textarea
                  value={managers}
                  onChange={(e) => setManagers(e.target.value)}
                  className="mt-2 w-full h-40 p-3 text-sm rounded-md border border-border bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter manager names, one per line..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  {managerList.length} managers configured
                </span>
                <Button onClick={handleSave} className="gap-2">
                  {isSaved ? (
                    <>
                      <span className="text-success">✓</span>
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>

              {/* Preview */}
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-sm font-medium mb-2">Preview</h3>
                <div className="flex flex-wrap gap-2">
                  {managerList.map((manager, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                    >
                      {manager}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data Settings */}
          <div className="panel p-6">
            <h2 className="text-lg font-semibold mb-4">Data Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">Max Stage Age Filter</p>
                  <p className="text-xs text-muted-foreground">Exclude deals older than this many days</p>
                </div>
                <span className="text-sm font-mono bg-secondary px-2 py-1 rounded">365 days</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">TDR Score Thresholds</p>
                  <p className="text-xs text-muted-foreground">Score ranges for priority levels</p>
                </div>
                <div className="text-xs font-mono space-y-1 text-right">
                  <p><span className="text-destructive">Critical:</span> 75+</p>
                  <p><span className="text-warning">High:</span> 50-74</p>
                  <p><span className="text-primary">Medium:</span> 35-49</p>
                  <p><span className="text-muted-foreground">Low:</span> &lt;35</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Data Source</p>
                  <p className="text-xs text-muted-foreground">Connected Domo datasets</p>
                </div>
                <span className="text-xs text-success">● Connected</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

