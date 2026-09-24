import React, { useState, useEffect } from 'react';
import type { Sponsor } from '@/shared/types';
import { api, ProblemsResponse } from '../api/client';
import {
  AlertTriangle,
  Phone,
  Globe,
  MessageCircle,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Send,
  HelpCircle,
  MailQuestion,
} from 'lucide-react';

interface ProblemsTabProps {
  onOpenDrawer: (sponsorId: number) => void;
  onRefreshSponsors: () => void;
}

export const ProblemsTab: React.FC<ProblemsTabProps> = ({ onOpenDrawer, onRefreshSponsors }) => {
  const [activeSubTab, setActiveSubTab] = useState<string>('no_email');
  const [data, setData] = useState<ProblemsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [fixEmailInput, setFixEmailInput] = useState('');
  const [isSubmittingFix, setIsSubmittingFix] = useState(false);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const res = await api.getProblems(activeSubTab);
      setData(res);
    } catch (err) {
      console.error('Failed to load problems:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, [activeSubTab]);

  const handleFixSubmit = async (sponsorId: number) => {
    if (!fixEmailInput.trim()) return;
    setIsSubmittingFix(true);
    try {
      await api.fixEmail(sponsorId, fixEmailInput.trim(), true);
      setFixingId(null);
      setFixEmailInput('');
      await fetchProblems();
      onRefreshSponsors();
    } catch (err: any) {
      alert(`Error updating email: ${err.message}`);
    } finally {
      setIsSubmittingFix(false);
    }
  };

  const getCleanWhatsAppLink = (phone: string | null) => {
    if (!phone) return null;
    // Strip non-digits
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '60' + digits.slice(1);
    } else if (digits.startsWith('60')) {
      // already has country code
    } else {
      digits = '60' + digits;
    }
    return `https://wa.me/${digits}`;
  };

  const subTabs = [
    { key: 'no_email', label: 'No Email', count: data?.counts.no_email },
    { key: 'shared_inbox', label: 'Shared Inboxes', count: data?.counts.shared_inbox },
    { key: 'suspicious_or_freemail', label: 'Freemail / Suspicious', count: data?.counts.suspicious_or_freemail },
    { key: 'no_mx', label: 'No MX', count: data?.counts.no_mx },
    { key: 'invalid_format', label: 'Invalid Format', count: data?.counts.invalid_format },
    { key: 'bounced', label: 'Bounced', count: data?.counts.bounced },
    { key: 'send_failures', label: 'Send Failures', count: data?.counts.send_failures },
  ];

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Problems Center — Couldn't Send or Needs Review
          </h2>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            Sponsors held back from automated sends. For no-email companies, call directly or find their CSR contact.
            You can fix emails inline to re-verify and queue immediately.
          </p>
        </div>
      </div>

      {/* Sub-tab pills */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-2 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-purple-800 text-purple-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Problem Items List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading problem records...</div>
        ) : data?.items?.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            No records in this category! Everything is resolved.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {data?.items?.map((s) => {
              const waLink = getCleanWhatsAppLink(s.phone);
              const isFixing = fixingId === s.id;

              return (
                <div
                  key={s.id}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Info */}
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[11px] font-bold text-purple-700 dark:text-purple-400">
                        {s.ref_no}
                      </span>
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {s.company_name}
                      </span>
                      {s.type && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {s.type}
                        </span>
                      )}
                    </div>

                    {/* Email info & raw text */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {s.primary_email ? (
                        <span>
                          Current email: <span className="font-mono text-slate-700 dark:text-slate-200">{s.primary_email}</span>
                        </span>
                      ) : (
                        <span className="text-rose-500 font-medium">No valid email found in source</span>
                      )}

                      {s.email_raw && s.email_raw !== s.primary_email && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          (raw: {s.email_raw})
                        </span>
                      )}

                      {s.shared_with_company && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          {s.shared_with_company}
                        </span>
                      )}
                    </div>

                    {/* Contact links: phone, website */}
                    <div className="flex items-center space-x-3 pt-1 text-xs">
                      {s.phone && (
                        <div className="flex items-center space-x-2">
                          <a
                            href={`tel:${s.phone}`}
                            className="inline-flex items-center text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400"
                          >
                            <Phone className="w-3.5 h-3.5 mr-1 text-purple-500" />
                            {s.phone}
                          </a>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-200"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3 mr-1" />
                              WhatsApp
                            </a>
                          )}
                        </div>
                      )}

                      {s.website && (
                        <a
                          href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Globe className="w-3.5 h-3.5 mr-1" />
                          Website
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right: Inline Fix Action */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {isFixing ? (
                      <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg border border-purple-300 dark:border-purple-700">
                        <input
                          type="email"
                          placeholder="e.g. csr@company.com"
                          value={fixEmailInput}
                          onChange={(e) => setFixEmailInput(e.target.value)}
                          className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-purple-500 text-slate-900 dark:text-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleFixSubmit(s.id)}
                          disabled={isSubmittingFix || !fixEmailInput.trim()}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                        >
                          {isSubmittingFix ? 'Saving...' : 'Save & Queue'}
                        </button>
                        <button
                          onClick={() => setFixingId(null)}
                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFixingId(s.id);
                            setFixEmailInput(s.primary_email || '');
                          }}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                          Fix Email
                        </button>

                        <button
                          onClick={() => onOpenDrawer(s.id)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          Details
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
