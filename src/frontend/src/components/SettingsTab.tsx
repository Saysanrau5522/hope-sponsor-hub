import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Settings,
  Database,
  Mail,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  Download,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Calendar,
} from 'lucide-react';

interface SettingsTabProps {
  onRefreshData?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ onRefreshData }) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [system, setSystem] = useState<any>({});
  const [backups, setBackups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const loadSettingsAndBackups = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, backupsRes] = await Promise.all([
        api.getSettings(),
        api.getBackups().catch(() => ({ backups: [] })),
      ]);
      setSettings(settingsRes.settings || {});
      setSystem(settingsRes.system || {});
      setBackups(backupsRes.backups || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsAndBackups();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res: any = await api.triggerBackup();
      setBackupMessage(
        `Backup saved successfully to ${res.backupPath} (${Math.round(res.sizeBytes / 1024)} KB)`
      );
      await loadSettingsAndBackups();
    } catch (err: any) {
      setBackupMessage(`Backup failed: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-xs text-slate-400">
        Loading system configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          Settings & Cloudflare Infrastructure
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure outreach pacing limits, send windows, Gmail connectivity, and automated R2 database backups.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully. Changes will apply on the next worker execution.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Pacing & Sending Parameters */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Outreach Pacing & Timezone Rules
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daily Ramp Schedule (emails/day)
              </label>
              <input
                type="text"
                value={settings.daily_cap_ramp || '25,50,80'}
                onChange={(e) =>
                  setSettings({ ...settings, daily_cap_ramp: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Comma-separated stages: Day 1 (25), Day 2 (50), Day 3+ (80)
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Daily Cap Limit
              </label>
              <input
                type="number"
                value={settings.daily_cap || '25'}
                onChange={(e) => setSettings({ ...settings, daily_cap: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Maximum dispatches permitted per calendar day in MYT
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Send Window Start (MYT)
              </label>
              <input
                type="text"
                value={settings.send_window_start || '09:00'}
                onChange={(e) =>
                  setSettings({ ...settings, send_window_start: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Monday to Friday start time (UTC+8)
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Send Window End (MYT)
              </label>
              <input
                type="text"
                value={settings.send_window_end || '16:30'}
                onChange={(e) =>
                  setSettings({ ...settings, send_window_end: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Strict stop time (UTC+8)
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Random Jitter Delay (Seconds)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.random_delay_min_sec || '60'}
                  onChange={(e) =>
                    setSettings({ ...settings, random_delay_min_sec: e.target.value })
                  }
                  className="w-1/2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="Min (60)"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="number"
                  value={settings.random_delay_max_sec || '180'}
                  onChange={(e) =>
                    setSettings({ ...settings, random_delay_max_sec: e.target.value })
                  }
                  className="w-1/2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="Max (180)"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Randomized interval between dispatches to mimic natural human typing
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Follow-up Threshold (Calendar Days)
              </label>
              <input
                type="number"
                value={settings.followup_after_days || '7'}
                onChange={(e) =>
                  setSettings({ ...settings, followup_after_days: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Days in MYT without response before triggering Follow-up badge
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Pacing Settings'}
            </button>
          </div>
        </div>
      </form>

      {/* Cloudflare R2 Database Backups */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Cloudflare R2 Database Snapshots
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Automated daily backup runs at 01:00 UTC (09:00 MYT). Stored securely in bucket{' '}
              <code className="text-purple-600 dark:text-purple-400">hope-assets/backups</code>.
            </p>
          </div>

          <button
            onClick={handleTriggerBackup}
            disabled={isBackingUp}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
            {isBackingUp ? 'Backing up...' : 'Backup Database Now'}
          </button>
        </div>

        {backupMessage && (
          <div className="p-3 text-xs rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200">
            {backupMessage}
          </div>
        )}

        {/* Existing Backups List */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Recent Snapshots ({backups.length})
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
              No backups created yet. Click "Backup Database Now" or wait for the 09:00 MYT daily cron.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {backups.map((b) => (
                <div
                  key={b.key}
                  className="p-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    <div>
                      <div className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {b.key}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Math.round(b.sizeBytes / 1024)} KB • Uploaded:{' '}
                        {new Date(b.uploadedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Verified R2 Object
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Gmail Connection Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Sender Gmail Account Status
        </h2>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              {settings.sender_email || 'hopebyssi@gmail.com'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Sender Name: {settings.sender_display_name || 'HOPE 5.0 | SSI USM'}
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              system.gmailConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {system.gmailConnected ? 'Connected & Ready' : 'Pending OAuth / Dry Run Active'}
          </span>
        </div>
      </div>
    </div>
  );
};
