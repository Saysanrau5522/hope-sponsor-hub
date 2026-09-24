import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  DollarSign,
  TrendingUp,
  Users,
  Mail,
  Eye,
  CheckCircle2,
  PhoneCall,
  Flame,
  Clock,
  Download,
  Activity,
  Send,
  Building,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { TabKey } from './Navbar';

interface OverviewTabProps {
  onSelectTab: (tab: TabKey) => void;
  onOpenDrawer: (sponsorId: number) => void;
  onRefreshData?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  onSelectTab,
  onOpenDrawer,
  onRefreshData,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.getOverviewAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatMYTDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading || !data) {
    return (
      <div className="p-16 text-center text-xs text-slate-400">
        Loading campaign overview...
      </div>
    );
  }

  const { kpis, pledge, activities } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            HOPE 5.0 Sponsorship Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sekretariat Sukarelawan India (SSI), Universiti Sains Malaysia • Campaign Command Center
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/sponsors/export/csv"
            download="hope_sponsors_export.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Full CSV
          </a>

          <button
            onClick={() => onSelectTab('send_center')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Send Center
          </button>
        </div>
      </div>

      {/* Sponsorship Thermometer Card */}
      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-purple-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-purple-300" />
                HOPE 5.0 Sponsorship Pledge Goal
              </div>
              <div className="text-3xl font-extrabold mt-1">
                RM {pledge.committedAmount.toLocaleString()}
                <span className="text-sm font-normal text-purple-200/80 ml-2">
                  / RM {pledge.targetAmount.toLocaleString()} Target
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-emerald-400">
                {pledge.percentage}%
              </div>
              <div className="text-xs text-purple-200/70">
                RM {pledge.remainingAmount.toLocaleString()} remaining to target
              </div>
            </div>
          </div>

          {/* Progress Bar Thermometer */}
          <div className="w-full bg-slate-800/80 rounded-full h-4 p-0.5 border border-purple-400/30 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-400 to-emerald-400 transition-all duration-1000 ease-out shadow-lg"
              style={{ width: `${Math.max(5, pledge.percentage)}%` }}
            />
          </div>

          {/* Tier Counts and Received Status */}
          <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-white/10 gap-2">
            <div className="flex items-center gap-4 text-purple-200/90">
              <span>
                <strong>{pledge.sponsorsCount}</strong> Committed Sponsors
              </span>
              <span>•</span>
              <span>
                Received in Bank: <strong>RM {pledge.receivedAmount.toLocaleString()}</strong>
              </span>
            </div>

            {pledge.tiers && pledge.tiers.length > 0 && (
              <div className="flex items-center gap-2">
                {pledge.tiers.map((t: any) => (
                  <span
                    key={t.pledge_tier}
                    className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-medium border border-white/10"
                  >
                    {t.pledge_tier}: {t.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Reach */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Sponsors Base</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {kpis.totalSponsors}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpis.validEmailCount} with email • {kpis.noEmailCount} phone-only
          </div>
        </div>

        {/* Outreach Sent */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Dispatched</span>
            <Send className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {kpis.contactedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpis.totalEmailsSent} emails sent ({kpis.bouncedCount} bounced)
          </div>
        </div>

        {/* Human Opens */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Human Opens</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {kpis.openedCount}
            <span className="text-xs font-semibold text-blue-500 ml-1.5">
              ({kpis.openRate}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Verified recipient engagement
          </div>
        </div>

        {/* Human Replies */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase">
            <span>Responses</span>
            <Mail className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {kpis.repliedCount}
            <span className="text-xs font-semibold text-emerald-500 ml-1.5">
              ({kpis.replyRate}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {kpis.callsLogged} phone calls logged
          </div>
        </div>
      </div>

      {/* Action Banners: Hot Leads & Follow-ups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hot Leads Card */}
        <div
          onClick={() => onSelectTab('calls')}
          className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 cursor-pointer hover:border-amber-400 transition shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500 text-white">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  {kpis.hotLeadsCount} Hot Leads Requiring Calls
                </h3>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Opened the proposal 2+ times in the last 24h. Call while interest is peak!
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
              View &rarr;
            </span>
          </div>
        </div>

        {/* Follow-ups Due Card */}
        <div
          onClick={() => onSelectTab('calls')}
          className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 cursor-pointer hover:border-blue-400 transition shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-600 text-white">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {kpis.followupsDueCount} Follow-ups Due (Day 7+)
                </h3>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                  Emails sent $\ge 7$ calendar days ago in MYT without a response.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
              View &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Live Audit & Activity Trail
          </h2>
          <span className="text-[11px] text-slate-400">All times Asia/Kuala_Lumpur (MYT)</span>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No activity logged yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {activities.map((act: any) => (
              <div
                key={act.id}
                className="py-2.5 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition px-2 rounded-lg"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Activity className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {act.company_name ? (
                        <button
                          onClick={() => onOpenDrawer(act.sponsor_id)}
                          className="hover:underline text-purple-600 dark:text-purple-400 mr-1"
                        >
                          {act.company_name} ({act.ref_no})
                        </button>
                      ) : null}
                      <span className="text-slate-500 font-normal">
                        — {act.details || act.action}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      by {act.actor_email}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 whitespace-nowrap">
                  {formatMYTDate(act.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
