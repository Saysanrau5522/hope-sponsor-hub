import React, { useState, useEffect } from 'react';
import type { Sponsor } from '@/shared/types';
import { api, SponsorListResponse } from '../api/client';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  Clock,
  Flame,
  Mail,
  Eye,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Ban,
  CheckCircle,
} from 'lucide-react';

interface SponsorsTabProps {
  onOpenDrawer: (sponsorId: number) => void;
  refreshTrigger: number;
}

export const SponsorsTab: React.FC<SponsorsTabProps> = ({ onOpenDrawer, refreshTrigger }) => {
  const [data, setData] = useState<SponsorListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkOwner, setBulkOwner] = useState('');
  const [isBulkActing, setIsBulkActing] = useState(false);

  const fetchSponsors = async () => {
    try {
      setLoading(true);
      const res = await api.getSponsors({
        q: search,
        stage: stageFilter,
        email_status: statusFilter,
        contact_quality: qualityFilter,
        page,
        limit: 50,
      });
      setData(res);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to load sponsors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, [search, stageFilter, statusFilter, qualityFilter, page, refreshTrigger]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!data?.sponsors) return;
    if (selectedIds.length === data.sponsors.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.sponsors.map((s) => s.id));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0) return;
    setIsBulkActing(true);
    try {
      if (action === 'assign_owner') {
        const owner = prompt('Enter team member email to assign:');
        if (!owner) return;
        await api.bulkActions(action, selectedIds, { owner });
      } else if (action === 'mark_already_contacted') {
        const date = prompt('Enter contacted date (YYYY-MM-DD) or leave empty for today:', new Date().toISOString().split('T')[0]);
        await api.bulkActions(action, selectedIds, { contacted_date: date });
      } else {
        await api.bulkActions(action, selectedIds);
      }
      await fetchSponsors();
    } catch (err: any) {
      alert(`Bulk action failed: ${err.message}`);
    } finally {
      setIsBulkActing(false);
    }
  };

  const getStageBadge = (s: Sponsor) => {
    if (s.is_hot_lead) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
          <Flame className="w-3 h-3 mr-1 text-orange-600" />
          Hot Lead
        </span>
      );
    }

    if (s.needs_followup) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          <Clock className="w-3 h-3 mr-1 text-amber-600" />
          Follow-up (Day {s.followup_day})
        </span>
      );
    }

    const stageColors: Record<string, string> = {
      not_contacted: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      sending: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
      sent: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
      opened: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
      replied: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      in_discussion: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
      committed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      received: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100 font-bold',
      declined: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
      bounced: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      invalid: 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      do_not_contact: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 line-through',
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${stageColors[s.stage] || stageColors.not_contacted}`}>
        {s.stage.replace(/_/g, ' ')}
      </span>
    );
  };

  const getEmailStatusBadge = (s: Sponsor) => {
    if (!s.primary_email || s.email_status === 'no_email') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          No Email
        </span>
      );
    }
    if (s.email_status === 'shared_inbox') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" title={s.shared_with_company || 'Shared Inbox'}>
          Shared Inbox
        </span>
      );
    }
    if (s.email_status === 'suspicious_domain') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
          Suspicious
        </span>
      );
    }
    if (s.email_status === 'no_mx') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
          No MX
        </span>
      );
    }
    if (s.email_status === 'invalid_format') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
          Invalid
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        Valid
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search company, ref, email, phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Stages</option>
            <option value="not_contacted">Not Contacted</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="opened">Opened</option>
            <option value="replied">Replied</option>
            <option value="in_discussion">In Discussion</option>
            <option value="committed">Committed</option>
            <option value="received">Received</option>
            <option value="declined">Declined</option>
            <option value="bounced">Bounced</option>
            <option value="do_not_contact">Do Not Contact</option>
          </select>

          {/* Email Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Email Statuses</option>
            <option value="valid">Valid</option>
            <option value="no_email">No Email (86)</option>
            <option value="shared_inbox">Shared Inbox</option>
            <option value="suspicious_domain">Suspicious</option>
            <option value="no_mx">No MX</option>
            <option value="invalid_format">Invalid Format</option>
          </select>

          {/* Contact Quality */}
          <select
            value={qualityFilter}
            onChange={(e) => {
              setQualityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Quality</option>
            <option value="csr_or_foundation">CSR / Foundation</option>
            <option value="generic_inbox">Generic Inbox</option>
            <option value="standard">Standard Direct</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when rows selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-4 py-2.5 rounded-xl shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2 text-xs font-semibold text-purple-900 dark:text-purple-200">
            <CheckCircle className="w-4 h-4 text-purple-600" />
            <span>{selectedIds.length} sponsors selected</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleBulkAction('approve_to_queue')}
              disabled={isBulkActing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition"
            >
              Approve to Queue
            </button>
            <button
              onClick={() => handleBulkAction('assign_owner')}
              disabled={isBulkActing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition"
            >
              Assign Owner
            </button>
            <button
              onClick={() => handleBulkAction('mark_already_contacted')}
              disabled={isBulkActing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition"
            >
              Mark Contacted
            </button>
            <button
              onClick={() => handleBulkAction('set_do_not_contact')}
              disabled={isBulkActing}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition"
            >
              Do Not Contact
            </button>
          </div>
        </div>
      )}

      {/* Main Sponsors Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10">
                  <button onClick={toggleSelectAll} className="p-0.5 text-slate-400 hover:text-slate-600">
                    {selectedIds.length > 0 && selectedIds.length === data?.sponsors?.length ? (
                      <CheckSquare className="w-4 h-4 text-purple-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3 w-36">Ref No.</th>
                <th className="p-3">Company Name</th>
                <th className="p-3 w-28">Type</th>
                <th className="p-3">Primary Email</th>
                <th className="p-3 w-28">Quality</th>
                <th className="p-3 w-36">Stage</th>
                <th className="p-3 w-24">Opens</th>
                <th className="p-3 w-24">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Loading sponsors...
                  </td>
                </tr>
              ) : data?.sponsors?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No sponsors match current filters.
                  </td>
                </tr>
              ) : (
                data?.sponsors?.map((s) => {
                  const isSelected = selectedIds.includes(s.id);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => onOpenDrawer(s.id)}
                      className={`cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors ${
                        isSelected ? 'bg-purple-50/70 dark:bg-purple-950/40' : ''
                      }`}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleSelect(s.id)} className="p-0.5 text-slate-400 hover:text-slate-600">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 font-mono text-[11px] font-semibold text-purple-700 dark:text-purple-400">
                        {s.ref_no}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {s.display_name || s.company_name}
                        </div>
                        {s.display_name !== s.company_name && (
                          <div className="text-[11px] text-slate-400">{s.company_name}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                        {s.type || '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs">{s.primary_email || '—'}</span>
                          {getEmailStatusBadge(s)}
                        </div>
                        {s.shared_with_company && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            {s.shared_with_company}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {s.contact_quality === 'csr_or_foundation' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            CSR/Foundation
                          </span>
                        ) : s.contact_quality === 'generic_inbox' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Generic
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Standard</span>
                        )}
                      </td>
                      <td className="p-3">{getStageBadge(s)}</td>
                      <td className="p-3">
                        {s.likely_human_opens ? (
                          <div className="flex items-center space-x-1 text-teal-600 dark:text-teal-400 font-semibold">
                            <Eye className="w-3.5 h-3.5" />
                            <span>{s.likely_human_opens}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({s.raw_opens})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[100px]">
                        {s.owner ? s.owner.split('@')[0] : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold">{((page - 1) * data.pagination.limit) + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(page * data.pagination.limit, data.pagination.total)}</span> of{' '}
              <span className="font-semibold">{data.pagination.total}</span> sponsors
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page >= data.pagination.totalPages}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
