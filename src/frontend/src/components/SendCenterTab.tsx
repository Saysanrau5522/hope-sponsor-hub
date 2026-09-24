import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
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
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res: any = await fetch('/api/gmail/status').then((r) => r.json());
      setGmailStatus(res);

      const auth: any = await api.getAuthMe();
      if (auth?.settings) {
        setSendEnabled(auth.settings.send_enabled === 'true');
        setDryRun(auth.settings.dry_run !== 'false');
      }
    } catch (err) {
      console.error('Failed to load Send Center status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnectGmail = async () => {
    try {
      const res: any = await fetch('/api/gmail/auth-url').then((r) => r.json());
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        alert(res.error || 'Failed to generate OAuth URL. Configure GMAIL_CLIENT_ID first.');
      }
    } catch (err: any) {
      alert(`OAuth initialization error: ${err.message}`);
    }
  };

  const handleSendTestToMyself = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/gmail/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json());

      setTestResult(res);
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
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                sendEnabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {sendEnabled ? '● SEND ENGINE ACTIVE' : '○ SEND ENGINE PAUSED'}
            </span>

            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                dryRun
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
              }`}
            >
              {dryRun ? 'DRY-RUN (Simulated)' : 'LIVE SENDS ENABLED'}
            </span>
          </div>

          <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
            Outreach Sending Engine
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automated pacing: 60–180s jitter, daily quota ramp (25, 50, 80), send window Mon–Fri 09:00–16:30 MYT.
          </p>
        </div>

        {/* Global Pause / Resume Switch */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setSendEnabled(!sendEnabled)}
            className={`inline-flex items-center px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition ${
              sendEnabled
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {sendEnabled ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Sending (Kill Switch)
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume Sending
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Gmail Connection Status & Send Test to Myself */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gmail Status Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Connected Gmail Account
              </h3>
            </div>
            {gmailStatus?.connected ? (
              <span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Not Connected
              </span>
            )}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
            <div className="text-slate-500">Official Sender Address:</div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {gmailStatus?.account || 'hopebyssi@gmail.com'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Scopes: gmail.send, gmail.readonly • Refresh token encrypted with AES-GCM in D1.
            </div>
          </div>

          {!gmailStatus?.connected && (
            <button
              onClick={handleConnectGmail}
              className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-sm"
            >
              <Zap className="w-4 h-4 mr-2" />
              Connect Gmail via Google OAuth
            </button>
          )}
        </div>

        {/* Send Test to Myself Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <Send className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Send Test to Myself
            </h3>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sends an outreach email directly to your logged-in email. Features:
            fake recipient ("TEST &amp; CO. SDN BHD"), real unchanged proposal PDF from R2,
            live letter DOCX dated today in MYT, and tracking pixel.
          </p>

          <button
            onClick={handleSendTestToMyself}
            disabled={sendingTest}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50"
          >
            {sendingTest ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating &amp; Sending Test...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Test to Myself Now
              </>
            )}
          </button>

          {testResult && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs space-y-1">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                Test Email Sent Successfully!
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                To: <span className="font-mono">{testResult.recipient}</span>
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Letter Dated: <span className="font-semibold">{testResult.dateText}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate">
                Tracking Token: {testResult.trackingToken}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
