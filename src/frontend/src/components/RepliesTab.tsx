import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Mail,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Clock,
  CheckCircle2,
  Building,
  Filter,
  User,
  ShieldAlert,
} from 'lucide-react';

interface RepliesTabProps {
  onOpenDrawer: (sponsorId: number) => void;
  onRefreshData?: () => void;
}

export const RepliesTab: React.FC<RepliesTabProps> = ({ onOpenDrawer, onRefreshData }) => {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, replies: 0, autoReplies: 0, bounces: 0 });
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState<string | null>(null);

  const loadReplies = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.getReplies(filterType);
      setItems(res.items || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReplies();
  }, [filterType]);

  const handlePollInbox = async () => {
    setIsPolling(true);
    setPollMessage(null);
    try {
      const res: any = await api.pollReplies();
      setPollMessage(
        `Checked ${res.checkedCount} messages. Found: ${res.newRepliesCount} replies, ${res.newBouncesCount} bounces, ${res.newAutoRepliesCount} auto-replies.`
      );
      await loadReplies();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setPollMessage(`Failed to poll inbox: ${err.message}`);
    } finally {
      setIsPolling(false);
    }
  };

  const handleOutcomeChange = async (id: number, outcome: string) => {
    try {
      await api.updateReply(id, { outcome });
      await loadReplies();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to update reply outcome:', err);
    }
  };

  const formatMYTDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Replies & Bounce Tracker
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time feed of corporate responses, out-of-office automated notices, and delivery bounce reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePollInbox}
            disabled={isPolling}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Polling Gmail...' : 'Check For New Replies'}
          </button>
        </div>
      </div>

      {pollMessage && (
        <div className="p-3 text-xs rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200 flex items-center justify-between">
          <span>{pollMessage}</span>
          <button onClick={() => setPollMessage(null)} className="text-purple-500 hover:text-purple-700 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Human Replies</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.replies}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Direct corporate responses</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Auto-Replies / OOO</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.autoReplies}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Automated responders</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Delivery Bounces</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{stats.bounces}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Hard & soft failures</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Total Logged</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Inbox notifications</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'all', label: 'All Messages' },
          { key: 'reply', label: 'Human Replies' },
          { key: 'auto_reply', label: 'Out of Office (OOO)' },
          { key: 'bounce_hard', label: 'Hard Bounces (5.x.x)' },
          { key: 'bounce_soft', label: 'Soft Bounces (4.x.x)' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === tab.key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Replies Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading replies...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Mail className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">No messages in this view</div>
            <p className="text-xs text-slate-400">
              When companies reply to outreach emails or when mailer-daemons report bounces, they will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Sponsor & Ref No</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Sender & Date (MYT)</th>
                  <th className="py-3 px-4">Message Snippet</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Sponsor Info */}
                    <td className="py-3 px-4">
                      {row.sponsor_id ? (
                        <button
                          onClick={() => onOpenDrawer(row.sponsor_id)}
                          className="text-left group font-semibold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{row.company_name || 'Unknown Sponsor'}</span>
                          </div>
                          <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                            {row.sponsor_ref_no || `ID: ${row.sponsor_id}`}
                          </div>
                        </button>
                      ) : (
                        <div className="text-slate-400 italic">Unmatched sender</div>
                      )}
                    </td>

                    {/* Classification Badge */}
                    <td className="py-3 px-4">
                      {row.type === 'reply' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Human Reply
                        </span>
                      )}
                      {row.type === 'auto_reply' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Clock className="w-3 h-3" />
                          Out of Office
                        </span>
                      )}
                      {row.type === 'bounce_hard' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <AlertCircle className="w-3 h-3" />
                          Hard Bounce {row.status_code || '5.x.x'}
                        </span>
                      )}
                      {row.type === 'bounce_soft' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <AlertCircle className="w-3 h-3" />
                          Soft Bounce {row.status_code || '4.x.x'}
                        </span>
                      )}
                    </td>

                    {/* Sender & Date */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={row.sender}>
                        {row.sender}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatMYTDate(row.received_at)}</div>
                    </td>

                    {/* Snippet */}
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed" title={row.snippet}>
                        {row.snippet || 'No preview available'}
                      </p>
                    </td>

                    {/* Outcome Dropdown */}
                    <td className="py-3 px-4">
                      {row.type === 'reply' ? (
                        <select
                          value={row.outcome || ''}
                          onChange={(e) => handleOutcomeChange(row.id, e.target.value)}
                          className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="">Pending Review</option>
                          <option value="interested">Interested</option>
                          <option value="need_more_info">Need More Info</option>
                          <option value="committed">Committed</option>
                          <option value="declined">Declined</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.gmail_deep_link && (
                          <a
                            href={row.gmail_deep_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-950 dark:hover:text-purple-300 transition-colors"
                          >
                            <span>Gmail</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {row.sponsor_id && (
                          <button
                            onClick={() => onOpenDrawer(row.sponsor_id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="View Sponsor Drawer"
                          >
                            <Building className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
