import React, { useState, useEffect } from 'react';
import { api, ValidationChunkResponse } from '../api/client';
import { X, CheckCircle2, AlertCircle, Play, Pause, RefreshCw, ShieldCheck } from 'lucide-react';

interface ValidationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidationComplete: () => void;
}

export const ValidationProgressModal: React.FC<ValidationProgressModalProps> = ({
  isOpen,
  onClose,
  onValidationComplete,
}) => {
  const [status, setStatus] = useState<{
    total_with_email: number;
    total_validated: number;
    remaining_to_validate: number;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<Array<{ id: number; company: string; email: string; status: string }>>([]);

  const loadStatus = async () => {
    try {
      const res: any = await api.getValidationStatus();
      setStatus(res);
    } catch (err) {
      console.error('Failed to load validation status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const runSingleChunk = async () => {
    try {
      const res: ValidationChunkResponse = await api.runValidationChunk();
      if (res.updated) {
        setLogs((prev) => [...res.updated!, ...prev].slice(0, 20));
      }
      await loadStatus();
      return res.completed || res.remaining === 0;
    } catch (err) {
      console.error('Chunk validation error:', err);
      return true; // Stop on error
    }
  };

  const handleStartAutoValidation = async () => {
    setIsRunning(true);
    let done = false;
    while (!done && isRunning) {
      done = await runSingleChunk();
      if (done) break;
      // brief 500ms delay between chunks
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsRunning(false);
    onValidationComplete();
  };

  if (!isOpen) return null;

  const total = status?.total_with_email || 399;
  const validated = status?.total_validated || 0;
  const percent = total > 0 ? Math.round((validated / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Email & DNS-over-HTTPS Validation Pipeline
            </h3>
          </div>
          <button
            onClick={() => {
              setIsRunning(false);
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Validates email addresses in chunks of 25 using Cloudflare 1.1.1.1 DNS-over-HTTPS (MX and fallback A record).
            Respects the Cloudflare Free Plan limit (50 subrequests per invocation).
          </p>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Validation Progress</span>
              <span>{percent}% ({validated} / {total})</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 text-right">
              {status?.remaining_to_validate || 0} remaining to validate
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2 pt-2">
            {isRunning ? (
              <button
                onClick={() => setIsRunning(false)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
              >
                <Pause className="w-4 h-4 mr-1.5" />
                Pause
              </button>
            ) : (
              <button
                onClick={handleStartAutoValidation}
                disabled={status?.remaining_to_validate === 0}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50"
              >
                <Play className="w-4 h-4 mr-1.5" />
                {status?.remaining_to_validate === 0 ? 'All Validated' : 'Start Validation'}
              </button>
            )}

            <button
              onClick={() => runSingleChunk()}
              disabled={isRunning || status?.remaining_to_validate === 0}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              Step Chunk (25)
            </button>
          </div>

          {/* Live Recent Updates Log */}
          {logs.length > 0 && (
            <div className="mt-4 space-y-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] block uppercase">
                Recent Validations:
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-slate-900 last:border-0">
                    <span className="truncate max-w-[240px] text-slate-800 dark:text-slate-200">{log.company} ({log.email})</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        log.status === 'valid'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-right">
          <button
            onClick={() => {
              setIsRunning(false);
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-xs font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
