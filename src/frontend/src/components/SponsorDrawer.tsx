import React, { useState, useEffect } from 'react';
import type { Sponsor } from '@/shared/types';
import { api } from '../api/client';
import {
  X,
  Phone,
  Globe,
  Mail,
  User,
  Clock,
  Save,
  CheckCircle2,
  Calendar,
  MessageCircle,
  Eye,
  DollarSign,
  Ban,
  FileText,
} from 'lucide-react';

interface SponsorDrawerProps {
  sponsorId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const SponsorDrawer: React.FC<SponsorDrawerProps> = ({ sponsorId, onClose, onUpdated }) => {
  const [data, setData] = useState<{ sponsor: Sponsor; history: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState('');
  const [doNotContact, setDoNotContact] = useState(false);
  const [pledgeTier, setPledgeTier] = useState('');
  const [pledgeAmount, setPledgeAmount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!sponsorId) {
      setData(null);
      return;
    }

    const loadDetails = async () => {
      try {
        setLoading(true);
        const res: any = await api.getSponsor(sponsorId);
        setData(res);
        setDisplayName(res.sponsor.display_name || res.sponsor.company_name);
        setEmail(res.sponsor.primary_email || '');
        setOwner(res.sponsor.owner || '');
        setNotes(res.sponsor.notes || '');
        setStage(res.sponsor.stage);
        setDoNotContact(res.sponsor.do_not_contact === 1);
        setPledgeTier(res.sponsor.pledge_tier || '');
        setPledgeAmount(res.sponsor.pledge_amount || 0);
      } catch (err) {
        console.error('Failed to load sponsor details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [sponsorId]);

  if (!sponsorId) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateSponsor(sponsorId, {
        display_name: displayName,
        primary_email: email,
        owner,
        notes,
        stage: stage as any,
        do_not_contact: doNotContact ? 1 : 0,
        pledge_tier: pledgeTier || null,
        pledge_amount: pledgeAmount,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      onUpdated();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const s = data?.sponsor;
  const history = data?.history;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-slide-left">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                {s?.ref_no}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-semibold uppercase">
                {s?.stage.replace(/_/g, ' ')}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {s?.company_name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading sponsor details...</div>
          ) : s ? (
            <>
              {/* Primary Contact Bar */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Phone:</span>
                  {s.phone ? (
                    <div className="flex items-center space-x-2 mt-0.5">
                      <a href={`tel:${s.phone}`} className="font-semibold text-slate-800 dark:text-slate-200 hover:underline">
                        {s.phone}
                      </a>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Website:</span>
                  {s.website ? (
                    <a
                      href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate block mt-0.5"
                    >
                      {s.website}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </div>

              {/* Editable Fields Form */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Editable Sponsor Details
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Display Name (used in Letter and Email)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Never auto-title-case; preserves special acronyms like MR.D.I.Y. and A&W.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Stage
                    </label>
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    >
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
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Owner (Team Member)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. tinethran@gmail.com"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Do Not Contact Toggle */}
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="dnc"
                    checked={doNotContact}
                    onChange={(e) => setDoNotContact(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <label htmlFor="dnc" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Do Not Contact (blocks all sending permanently)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add team notes, contact persons, phone call outcomes..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Pledge Fields */}
                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 space-y-3">
                  <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center">
                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                    Sponsorship Pledge & Tier
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-purple-700 dark:text-purple-300 mb-0.5">Tier</label>
                      <select
                        value={pledgeTier}
                        onChange={(e) => setPledgeTier(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg"
                      >
                        <option value="">None / Pending</option>
                        <option value="Diamond">Diamond (RM 5,000+)</option>
                        <option value="Platinum">Platinum (RM 3,000)</option>
                        <option value="Gold">Gold (RM 1,200)</option>
                        <option value="Silver/In-kind">Silver / In-kind (RM 500)</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-purple-700 dark:text-purple-300 mb-0.5">Pledge (RM)</label>
                      <input
                        type="number"
                        value={pledgeAmount || ''}
                        onChange={(e) => setPledgeAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline / Activity History */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Activity Timeline
                </h3>

                {history?.activities?.length === 0 ? (
                  <p className="text-xs text-slate-400">No activity logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history?.activities?.map((act: any) => (
                      <div key={act.id} className="text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{act.actor_email}</span>
                          <span>{new Date(act.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mt-1">{act.details || act.action}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer with Save */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400">
            {savedSuccess && (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Changes saved!
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={`/api/templates/letter/preview?sponsor_id=${s?.id}`}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition"
              title="Preview and download letter dated today in MYT"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Preview Letter
            </a>

            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Close
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
