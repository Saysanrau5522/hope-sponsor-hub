import React from 'react';
import {
  Users,
  AlertTriangle,
  Mail,
  PhoneCall,
  FileText,
  Send,
  Settings,
  LayoutDashboard,
  CheckCircle2,
  Moon,
  Sun,
  ShieldCheck,
} from 'lucide-react';

export type TabKey =
  | 'overview'
  | 'sponsors'
  | 'problems'
  | 'replies'
  | 'calls'
  | 'templates'
  | 'send_center'
  | 'settings';

interface NavbarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  problemCount: number;
  userEmail: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenValidationModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  problemCount,
  userEmail,
  isDark,
  onToggleTheme,
  onOpenValidationModal,
}) => {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'sponsors', label: 'Sponsors', icon: Users },
    { key: 'problems', label: 'Problems', icon: AlertTriangle, badge: problemCount > 0 ? problemCount : undefined },
    { key: 'replies', label: 'Replies', icon: Mail },
    { key: 'calls', label: 'Call List', icon: PhoneCall },
    { key: 'templates', label: 'Templates', icon: FileText },
    { key: 'send_center', label: 'Send Center', icon: Send },
    { key: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
              H5
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                  HOPE Sponsor Hub
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                  HOPE 5.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">SSI USM • Chase The Light</p>
            </div>
          </div>

          {/* Validation & User Info */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenValidationModal}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/80 border border-purple-200 dark:border-purple-800 transition shadow-sm"
              title="Validate email syntax and MX records"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-purple-600 dark:text-purple-400" />
              Validate Emails
            </button>

            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-mono text-[11px] truncate max-w-[140px]">{userEmail}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 -mb-px overflow-x-auto pb-1 sm:pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onSelectTab(tab.key as TabKey)}
                className={`flex items-center px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
                      tab.key === 'problems'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
