import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { Sponsor } from '@/shared/types';
import {
  Send,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Mail,
  ShieldCheck,
  Zap,
  Clock,
  ExternalLink,
  Flame,
  CheckSquare,
  Square,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SendCenterTabProps {
  onRefreshData?: () => void;
}

export const SendCenterTab: React.FC<SendCenterTabProps> = ({ onRefreshData }) => {
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    account: string;
    clientIdConfigured: boolean;
  } | null>(null);

  const [sendEnabled, setSendEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [queueStats, setQueueStats] = useState<any>(null);

  // Send test state
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Batch Review Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<any>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Pilot of 5 Modal state
  const [isPilotModalOpen, setIsPilotModalOpen] = useState(false);
  const [pilotCandidates, setPilotCandidates] = useState<Sponsor[]>([]);
  const [selectedPilotIds, setSelectedPilotIds] = useState<number[]>([]);
  const [isQueueingPilot, setIsQueueingPilot] = useState(false);

  // Manual tick
  const [triggeringTick, setTriggeringTick] = useState(false);
  const [tickResult, setTickResult] = useState<any>(null);

  const loadAll = async () => {
    try {
      const gRes: any = await fetch('/api/gmail/status').then((r) => r.json());
      setGmailStatus(gRes);

      const qStats: any = await fetch('/api/queue/stats').then((r) => r.json());
      setQueueStats(qStats);

      const auth: any = await api.getAuthMe();
      if (auth?.settings) {
        setSendEnabled(auth.settings.send_enabled === 'true');
        setDryRun(auth.settings.dry_run !== 'false');
      }
    } catch (err) {
      console.error('Failed to load Send Center data', err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleToggleControls = async (newEnabled: boolean, newDryRun: boolean) => {
    setSendEnabled(newEnabled);
    setDryRun(newDryRun);
    try {
      await fetch('/api/queue/controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_enabled: newEnabled, dry_run: newDryRun }),
      });
      await loadAll();
    } catch (err: any) {
      alert(`Failed to update controls: ${err.message}`);
    }
  };

  const handleOpenReviewModal = async () => {
    try {
      const summary = await fetch('/api/queue/review').then((r) => r.json());
      setReviewSummary(summary);
      setIsReviewModalOpen(true);
    } catch (err: any) {
      alert(`Failed to load review summary: ${err.message}`);
    }
  };

  const handleApproveBatch = async () => {
    setIsApproving(true);
    try {
      const res: any = await fetch('/api/queue/approve-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json());

      setIsReviewModalOpen(false);
      alert(`Success! ${res.count} sponsors approved into outreach queue.`);
      await loadAll();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Failed to approve batch: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleOpenPilotModal = async () => {
    try {
      const res: any = await fetch('/api/queue/pilot-candidates').then((r) => r.json());
      setPilotCandidates(res.candidates || []);
      // default select first 5
      setSelectedPilotIds((res.candidates || []).slice(0, 5).map((s: any) => s.id));
      setIsPilotModalOpen(true);
    } catch (err: any) {
      alert(`Failed to load pilot candidates: ${err.message}`);
    }
  };

  const handleQueuePilot = async () => {
    if (selectedPilotIds.length === 0) return;
    setIsQueueingPilot(true);
    try {
      const res: any = await fetch('/api/queue/approve-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsor_ids: selectedPilotIds }),
      }).then((r) => r.json());

      setIsPilotModalOpen(false);
      alert(`Pilot batch queued! ${res.count} sponsors entered queue.`);
      await loadAll();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Failed to queue pilot: ${err.message}`);
    } finally {
      setIsQueueingPilot(false);
    }
  };

  const handleTriggerTick = async (force = false) => {
    setTriggeringTick(true);
    setTickResult(null);
    try {
      const res: any = await fetch(`/api/queue/tick?force=${force}`, {
        method: 'POST',
      }).then((r) => r.json());
      setTickResult(res);
      await loadAll();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Tick failed: ${err.message}`);
    } finally {
      setTriggeringTick(false);
    }
  };

  const handleSendTestToMyself = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res: any = await fetch('/api/gmail/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json());

      setTestResult(res);
      await loadAll();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Send test failed: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Controls Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                sendEnabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {sendEnabled ? '● SEND ENGINE RUNNING' : '○ SEND ENGINE PAUSED'}
            </span>

            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                dryRun
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
              }`}
            >
              {dryRun ? 'DRY-RUN (Simulated)' : 'LIVE SENDS ACTIVE'}
            </span>

            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                queueStats?.quota?.insideWindow
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Clock className="w-3 h-3 mr-1" />
              {queueStats?.quota?.insideWindow
                ? 'Inside Window (09:00 - 16:30 MYT)'
                : 'Outside Send Window'}
            </span>
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            Outreach Sending Engine &amp; Pacing Controls
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Send window: Mon–Fri 09:00–16:30 MYT • Pacing gap: 60–180s jitter • Quota ramp: 25, 50, then 80 per day.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleToggleControls(sendEnabled, !dryRun)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition"
          >
            Toggle {dryRun ? 'Live Sends' : 'Dry Run'}
          </button>

          <button
            onClick={() => handleToggleControls(!sendEnabled, dryRun)}
            className={`inline-flex items-center px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition ${
              sendEnabled
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {sendEnabled ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Engine (Kill Switch)
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume Sending Engine
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Quota & Queue Progress Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Today's MYT Quota</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {queueStats?.quota?.sentToday || 0} / {queueStats?.quota?.cap || 25}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
            {queueStats?.quota?.remainingToday || 0} remaining today
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Queued in D1</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {queueStats?.counts?.queued || 0}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Awaiting minute tick</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Total Sent</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {queueStats?.counts?.sent || 0}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Initial outreaches delivered</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Failed / Errored</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {queueStats?.counts?.failed || 0}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Checked in Problems tab</div>
        </div>
      </div>

      {/* 3. Action Triggers: Batch Approval, Pilot of 5, Test to Myself */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Approve Full Batch */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
              <Layers className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Approve Batch into Queue
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review count, first/last company, finish time estimate, and warnings before queueing ready sponsors.
            </p>
          </div>

          <button
            onClick={handleOpenReviewModal}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm"
          >
            Review &amp; Approve Batch
          </button>
        </div>

        {/* Send Pilot of 5 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
              <Flame className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Send Pilot of 5
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Handpick 5 companies to send first as an initial pilot run to verify deliverability and open tracking.
            </p>
          </div>

          <button
            onClick={handleOpenPilotModal}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm"
          >
            Select &amp; Send Pilot of 5
          </button>
        </div>

        {/* Send Test to Myself */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <Mail className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Send Test to Myself
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instant test email to your logged-in address with real proposal PDF and live letter dated today.
            </p>
          </div>

          <button
            onClick={handleSendTestToMyself}
            disabled={sendingTest}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50"
          >
            {sendingTest ? 'Sending Test...' : 'Send Test to Myself'}
          </button>
        </div>
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-1">
          <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
            Test Email Dispatched Successfully!
          </div>
          <div className="text-emerald-700 dark:text-emerald-400">
            Recipient: <span className="font-mono">{testResult.recipient}</span> • Letter Dated:{' '}
            <span className="font-semibold">{testResult.dateText}</span> • Mode:{' '}
            <span className="font-semibold">{testResult.dryRun ? 'DRY-RUN' : 'LIVE'}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500 truncate">
            Tracking Token: {testResult.trackingToken}
          </div>
        </div>
      )}

      {/* Manual Cron Tick Simulator */}
      <div className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200">Minute Cron Tick Runner:</span>
          <span className="text-slate-500 dark:text-slate-400 ml-2">
            The minute cron (* * * * *) processes 1 due outreach every minute. You can manually step the tick.
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleTriggerTick(false)}
            disabled={triggeringTick}
            className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 font-medium transition disabled:opacity-50"
          >
            Step Tick
          </button>
          <button
            onClick={() => handleTriggerTick(true)}
            disabled={triggeringTick}
            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition disabled:opacity-50"
          >
            Force Tick Now
          </button>
        </div>
      </div>

      {tickResult && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-mono text-purple-900 dark:text-purple-300">
          Tick output: {JSON.stringify(tickResult)}
        </div>
      )}

      {/* BATCH APPROVAL REVIEW MODAL */}
      {isReviewModalOpen && reviewSummary && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Batch Approval Review Screen
                </h3>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Eligible Ready Count:</span>
                <span className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {reviewSummary.eligibleCount} Companies
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Estimated Sending Duration:</span>
                <span className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  ~{reviewSummary.estimatedFinishDays} Business Days
                </span>
                <span className="text-[10px] text-slate-400 block">Ramp: 25 &rarr; 50 &rarr; 80 / day</span>
              </div>
            </div>

            {/* Boundary Companies */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">First in Queue:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reviewSummary.firstCompany?.ref_no} — {reviewSummary.firstCompany?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last in Queue:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reviewSummary.lastCompany?.ref_no} — {reviewSummary.lastCompany?.name}
                </span>
              </div>
            </div>

            {/* Mandatory Warnings */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                Pre-Queue Verification &amp; Warnings
              </h4>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5 text-amber-900 dark:text-amber-200">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Important Delivery Checks:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                  <li>
                    <strong>{reviewSummary.warnings.sharedInboxesCount} Shared Inboxes:</strong> Secondary companies sharing an address are held back in Problems for manual decision.
                  </li>
                  <li>
                    <strong>{reviewSummary.warnings.freemailCount} Freemail Addresses:</strong> Contacts using Gmail/Yahoo addresses are flagged in Problems.
                  </li>
                  <li>
                    <strong>{reviewSummary.warnings.suspiciousDomainCount} Suspicious Domain:</strong> Bogus domain is held back permanently.
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveBatch}
                disabled={isApproving || reviewSummary.eligibleCount === 0}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition disabled:opacity-50"
              >
                {isApproving ? 'Approving Batch...' : 'Approve Batch into Queue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PILOT OF 5 MODAL */}
      {isPilotModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Flame className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Select 5 Pilot Sponsors
                </h3>
              </div>
              <button onClick={() => setIsPilotModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select which companies will receive the pilot outreach to test deliverability. Selected:{' '}
              <span className="font-bold text-purple-600">{selectedPilotIds.length} / 5</span>
            </p>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
              {pilotCandidates.map((s) => {
                const isSelected = selectedPilotIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPilotIds((prev) => prev.filter((i) => i !== s.id));
                      } else {
                        if (selectedPilotIds.length >= 5) {
                          alert('You can select at most 5 sponsors for the pilot batch.');
                          return;
                        }
                        setSelectedPilotIds((prev) => [...prev, s.id]);
                      }
                    }}
                    className={`p-3 flex items-center justify-between cursor-pointer transition ${
                      isSelected ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {s.display_name || s.company_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {s.ref_no} • {s.primary_email}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {s.type || 'Standard'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsPilotModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleQueuePilot}
                disabled={isQueueingPilot || selectedPilotIds.length === 0}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50"
              >
                {isQueueingPilot ? 'Queueing Pilot...' : `Queue Pilot (${selectedPilotIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
