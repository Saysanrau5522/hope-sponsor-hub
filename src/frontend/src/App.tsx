import React, { useState, useEffect } from 'react';
import { Navbar, TabKey } from './components/Navbar';
import { SponsorsTab } from './components/SponsorsTab';
import { ProblemsTab } from './components/ProblemsTab';
import { SponsorDrawer } from './components/SponsorDrawer';
import { ValidationProgressModal } from './components/ValidationProgressModal';
import { api } from './api/client';
import {
  Users,
  AlertTriangle,
  Mail,
  Send,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  Flame,
  ShieldAlert,
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('sponsors');
  const [isDark, setIsDark] = useState<boolean>(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [userEmail, setUserEmail] = useState<string>('hopebyssi@gmail.com');
  const [problemCount, setProblemCount] = useState<number>(0);
  const [drawerSponsorId, setDrawerSponsorId] = useState<number | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    // Load session and problem stats
    const initApp = async () => {
      try {
        const auth = await api.getAuthMe();
        if (auth?.user?.email) {
          setUserEmail(auth.user.email);
        }
      } catch (err) {
        console.warn('Local dev session fallback');
      }

      try {
        const probs = await api.getProblems();
        if (probs?.counts) {
          const total =
            probs.counts.no_email +
            probs.counts.invalid_format +
            probs.counts.no_mx +
            probs.counts.bounced +
            probs.counts.shared_inbox +
            probs.counts.suspicious_or_freemail +
            probs.counts.send_failures;
          setProblemCount(total);
        }
      } catch (err) {
        console.error('Failed to load initial problem stats', err);
      }
    };

    initApp();
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        problemCount={problemCount}
        userEmail={userEmail}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenValidationModal={() => setIsValidationModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'sponsors' && (
          <SponsorsTab
            onOpenDrawer={(id) => setDrawerSponsorId(id)}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'problems' && (
          <ProblemsTab
            onOpenDrawer={(id) => setDrawerSponsorId(id)}
            onRefreshSponsors={handleRefresh}
          />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Quick KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-slate-400 text-xs font-semibold uppercase">Total Sponsors</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">485</div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">399 with valid email</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-slate-400 text-xs font-semibold uppercase">Ready to Queue</div>
                <div className="text-2xl font-bold text-blue-600 mt-1">391</div>
                <div className="text-xs text-slate-400 mt-0.5">Pending batch approval</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-slate-400 text-xs font-semibold uppercase">Problems / Holdback</div>
                <div className="text-2xl font-bold text-amber-600 mt-1">{problemCount}</div>
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">86 missing, 7 shared inboxes</div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-slate-400 text-xs font-semibold uppercase">Sponsorship Target</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">RM 10,140</div>
                <div className="text-xs text-slate-400 mt-0.5">Corporate funding goal</div>
              </div>
            </div>

            {/* Phase 2-6 Roadmap Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                HOPE 5.0 Sponsorship Pipeline Setup
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                  <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center mb-1">
                    <FileText className="w-4 h-4 mr-1 text-purple-600" />
                    Phase 2: Templates & Letters
                  </div>
                  <p className="text-purple-700 dark:text-purple-300">
                    Just-in-time DOCX letter generator with fflate, golden test diffing, and PDF viewer.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center mb-1">
                    <Send className="w-4 h-4 mr-1 text-indigo-500" />
                    Phase 3: Gmail & Tracking
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    OAuth connect, MIME builder, hope-pixel open classification.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center mb-1">
                    <TrendingUp className="w-4 h-4 mr-1 text-emerald-500" />
                    Phase 4-6: Queue, Polling & Polish
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Cron sender, ramp caps, inbox replies, follow-ups, and pledge thermometer.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'replies' ||
          activeTab === 'calls' ||
          activeTab === 'templates' ||
          activeTab === 'send_center' ||
          activeTab === 'settings') && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-sm space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white capitalize">
              {activeTab.replace('_', ' ')} Tab
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              This module will be activated in upcoming phases. Phase 1 Foundation establishes the core schema,
              idempotent 485-sponsor import, DoH validation pipeline, Sponsors directory, and Problems holdback center.
            </p>
          </div>
        )}
      </main>

      {/* Slide-out Drawer */}
      <SponsorDrawer
        sponsorId={drawerSponsorId}
        onClose={() => setDrawerSponsorId(null)}
        onUpdated={handleRefresh}
      />

      {/* Validation Progress Modal */}
      <ValidationProgressModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        onValidationComplete={handleRefresh}
      />
    </div>
  );
};
