import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { LogCallModal } from './LogCallModal';
import {
  PhoneCall,
  Flame,
  Clock,
  AlertTriangle,
  Phone,
  Search,
  Building,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface CallListTabProps {
  onOpenDrawer: (sponsorId: number) => void;
  onRefreshData?: () => void;
}

export const CallListTab: React.FC<CallListTabProps> = ({ onOpenDrawer, onRefreshData }) => {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    hotLeads: 0,
    followupsDue: 0,
    bounced: 0,
    noEmail: 0,
  });
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedSponsorForCall, setSelectedSponsorForCall] = useState<any | null>(null);

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.getCallQueue();
      setItems(res.items || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load call queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const filteredItems = items.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const comp = item.sponsor.company_name?.toLowerCase() || '';
      const ref = item.sponsor.ref_no?.toLowerCase() || '';
      const phone = item.sponsor.phone?.toLowerCase() || '';
      return comp.includes(q) || ref.includes(q) || phone.includes(q);
    }
    return true;
  });

  const getCleanPhone = (p: string | null) => {
    if (!p) return '';
    return p.replace(/[^0-9]/g, '');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Priority Call Queue & Outreach Action List
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Prioritized calling queue automatically generated from live tracking: hot leads, 7-day follow-ups, and direct phone outreach.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setActiveCategory('all')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === 'all'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Total in Queue</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ready for phone outreach</div>
        </button>

        <button
          onClick={() => setActiveCategory('hot_lead')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === 'hot_lead'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" />
            Hot Leads
          </div>
          <div className="text-xl font-bold text-amber-600 mt-1">{stats.hotLeads}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">2+ opens in last 24h</div>
        </button>

        <button
          onClick={() => setActiveCategory('followup_due')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === 'followup_due'
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Follow-ups Due
          </div>
          <div className="text-xl font-bold text-blue-600 mt-1">{stats.followupsDue}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">7+ days since email</div>
        </button>

        <button
          onClick={() => setActiveCategory('bounced_email')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === 'bounced_email'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Bounced Email
          </div>
          <div className="text-xl font-bold text-rose-600 mt-1">{stats.bounced}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Call for new email</div>
        </button>

        <button
          onClick={() => setActiveCategory('no_email')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            activeCategory === 'no_email'
              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-sm'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            Phone Only
          </div>
          <div className="text-xl font-bold text-purple-600 mt-1">{stats.noEmail}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">No email in sponsor list</div>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filter call queue by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Queue Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading call list...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <PhoneCall className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              No sponsors in this category right now
            </div>
            <p className="text-xs text-slate-400">
              All clear! Calls will populate as emails are opened repeatedly, reach the 7-day follow-up mark, or bounce.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Priority & Trigger</th>
                  <th className="py-3 px-4">Company & Ref No</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Last Activity / Call</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item, idx) => {
                  const s = item.sponsor;
                  const cleanPhone = getCleanPhone(s.phone);
                  const waUrl = cleanPhone
                    ? `https://wa.me/${cleanPhone.startsWith('60') ? cleanPhone : '60' + cleanPhone.replace(/^0/, '')}`
                    : null;

                  return (
                    <tr
                      key={`${s.id}-${idx}`}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Priority Tag */}
                      <td className="py-3 px-4">
                        {item.category === 'hot_lead' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                            <span>HOT LEAD ({item.opens24h} opens)</span>
                          </div>
                        )}
                        {item.category === 'followup_due' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>FOLLOW-UP DUE (Day 7+)</span>
                          </div>
                        )}
                        {item.category === 'bounced_email' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>BOUNCED EMAIL</span>
                          </div>
                        )}
                        {item.category === 'no_email' && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Phone className="w-3.5 h-3.5 text-purple-600" />
                            <span>PHONE ONLY</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 mt-1 max-w-xs">{item.reason}</div>
                      </td>

                      {/* Company Name */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onOpenDrawer(s.id)}
                          className="text-left font-semibold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 group"
                        >
                          <div>{s.company_name}</div>
                          <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                            {s.ref_no}
                          </div>
                        </button>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                          {s.phone || '-'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {s.phone && (
                            <a
                              href={`tel:${s.phone}`}
                              className="inline-flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              Call
                            </a>
                          )}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              WhatsApp ↗
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3 px-4">
                        {s.last_call_outcome ? (
                          <div className="text-slate-700 dark:text-slate-300">
                            <span className="font-medium">Last call: </span>
                            <span className="capitalize">{s.last_call_outcome.replace('_', ' ')}</span>
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">No calls logged yet</div>
                        )}
                        {s.notes && (
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {s.notes}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedSponsorForCall(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Log Call
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Call Modal */}
      {selectedSponsorForCall && (
        <LogCallModal
          isOpen={Boolean(selectedSponsorForCall)}
          onClose={() => setSelectedSponsorForCall(null)}
          sponsor={selectedSponsorForCall}
          onCallLogged={() => {
            loadQueue();
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </div>
  );
};
