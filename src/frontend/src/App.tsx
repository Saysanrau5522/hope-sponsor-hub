import React, { useState, useEffect } from 'react';
import { Navbar, TabKey } from './components/Navbar';
import { OverviewTab } from './components/OverviewTab';
import { SponsorsTab } from './components/SponsorsTab';
import { ProblemsTab } from './components/ProblemsTab';
import { SponsorDrawer } from './components/SponsorDrawer';
import { ValidationProgressModal } from './components/ValidationProgressModal';
import { TemplatesTab } from './components/TemplatesTab';
import { SendCenterTab } from './components/SendCenterTab';
import { RepliesTab } from './components/RepliesTab';
import { CallListTab } from './components/CallListTab';
import { SettingsTab } from './components/SettingsTab';
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
        const auth: any = await api.getAuthMe();
        if (auth?.user?.email) {
          setUserEmail(auth.user.email);
        }
      } catch (err) {
        console.warn('Local dev session fallback');
      }

      try {
        const probs: any = await api.getProblems();
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
          <OverviewTab
            onSelectTab={setActiveTab}
            onOpenDrawer={(id) => setDrawerSponsorId(id)}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'templates' && <TemplatesTab />}

        {activeTab === 'send_center' && <SendCenterTab onRefreshData={handleRefresh} />}

        {activeTab === 'replies' && (
          <RepliesTab
            onOpenDrawer={(id) => setDrawerSponsorId(id)}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'calls' && (
          <CallListTab
            onOpenDrawer={(id) => setDrawerSponsorId(id)}
            onRefreshData={handleRefresh}
          />
        )}

        {activeTab === 'settings' && <SettingsTab onRefreshData={handleRefresh} />}
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
