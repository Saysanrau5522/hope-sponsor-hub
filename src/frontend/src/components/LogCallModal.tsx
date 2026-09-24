import React, { useState } from 'react';
import { api } from '../api/client';
import { PhoneCall, X, CheckCircle2, MessageSquare, DollarSign, Calendar, AlertCircle } from 'lucide-react';

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  sponsor: any;
  onCallLogged: () => void;
}

export const LogCallModal: React.FC<LogCallModalProps> = ({
  isOpen,
  onClose,
  sponsor,
  onCallLogged,
}) => {
  if (!isOpen || !sponsor) return null;

  const [caller, setCaller] = useState<string>('Sponsorship Team');
  const [outcome, setOutcome] = useState<string>('reached_interested');
  const [notes, setNotes] = useState<string>('');
  const [callbackDate, setCallbackDate] = useState<string>('');
  const [pledgeTier, setPledgeTier] = useState<string>('Silver');
  const [pledgeAmount, setPledgeAmount] = useState<string>('1500');
  const [inKindDesc, setInKindDesc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        sponsor_id: sponsor.id,
        caller,
        outcome,
        notes,
        callback_date: callbackDate || undefined,
      };

      if (outcome === 'reached_committed') {
        payload.pledge_tier = pledgeTier;
        payload.pledge_amount = parseFloat(pledgeAmount) || 0;
        if (inKindDesc) payload.in_kind_description = inKindDesc;
      }

      await api.logCall(payload);
      onCallLogged();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record call');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCleanPhone = (p: string | null) => {
    if (!p) return '';
    return p.replace(/[^0-9]/g, '');
  };

  const cleanPhone = getCleanPhone(sponsor.phone);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Call with {sponsor.company_name}
                </h3>
                <div className="text-xs text-purple-600 dark:text-purple-400 font-mono">
                  {sponsor.ref_no}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Phone Actions */}
        {sponsor.phone && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Phone: </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{sponsor.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${sponsor.phone}`}
                className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
              >
                Call
              </a>
              {cleanPhone && (
                <a
                  href={`https://wa.me/${cleanPhone.startsWith('60') ? cleanPhone : '60' + cleanPhone.replace(/^0/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                >
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Caller Name
              </label>
              <input
                type="text"
                value={caller}
                onChange={(e) => setCaller(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Call Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="reached_interested">Reached - Interested</option>
                <option value="reached_more_info">Reached - Requested More Info</option>
                <option value="reached_committed">Reached - Committed to Pledge! 🎉</option>
                <option value="reached_declined">Reached - Declined</option>
                <option value="callback_requested">Call Back Later</option>
                <option value="no_answer">No Answer / Voicemail</option>
                <option value="wrong_number">Wrong Number / Invalid</option>
              </select>
            </div>
          </div>

          {/* Conditional Committed Fields */}
          {outcome === 'reached_committed' && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Pledge Commitment Details
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                    Pledge Tier
                  </label>
                  <select
                    value={pledgeTier}
                    onChange={(e) => {
                      setPledgeTier(e.target.value);
                      if (e.target.value === 'Platinum') setPledgeAmount('5000');
                      else if (e.target.value === 'Gold') setPledgeAmount('3000');
                      else if (e.target.value === 'Silver') setPledgeAmount('1500');
                      else if (e.target.value === 'Bronze') setPledgeAmount('500');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-slate-200"
                  >
                    <option value="Platinum">Platinum (RM 5,000+)</option>
                    <option value="Gold">Gold (RM 3,000+)</option>
                    <option value="Silver">Silver (RM 1,500+)</option>
                    <option value="Bronze">Bronze (RM 500+)</option>
                    <option value="Custom">Custom / Other Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                    Amount (RM)
                  </label>
                  <input
                    type="number"
                    value={pledgeAmount}
                    onChange={(e) => setPledgeAmount(e.target.value)}
                    required
                    min="1"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-emerald-700 dark:text-emerald-400 font-semibold mb-1">
                  In-Kind / Goodies Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 bottles of water, vouchers, stationery"
                  value={inKindDesc}
                  onChange={(e) => setInKindDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          )}

          {/* Callback Date */}
          {outcome === 'callback_requested' && (
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Callback Date & Time (MYT)
              </label>
              <input
                type="datetime-local"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
              Call Notes & Key Takeaways
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Spoke to Ms. Siti in HR. She asked to resend proposal to her personal corporate email sitihr@... and will bring up at Friday board meeting."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Call...' : 'Save Call Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
