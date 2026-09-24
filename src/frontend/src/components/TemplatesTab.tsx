import React, { useState, useEffect, useRef } from 'react';
import * as docx from 'docx-preview';
import { api } from '../api/client';
import type { Sponsor } from '@/shared/types';
import { VERBATIM_EMAIL_SUBJECT, VERBATIM_EMAIL_BODY_TEXT } from '@/shared/constants';
import {
  FileText,
  Mail,
  Download,
  Copy,
  Check,
  Eye,
  AlertCircle,
  Save,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const TemplatesTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'email' | 'proposal' | 'letter' | 'followup'>('letter');
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedSponsorId, setSelectedSponsorId] = useState<number | ''>('');
  const [selectedCompanyName, setSelectedCompanyName] = useState('TEST & CO. SDN BHD');
  const [copied, setCopied] = useState(false);

  // Letter preview state
  const [letterBlob, setLetterBlob] = useState<Blob | null>(null);
  const [letterRefNo, setLetterRefNo] = useState('');
  const [letterDateText, setLetterDateText] = useState('');
  const [letterLoading, setLetterLoading] = useState(false);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Follow-up template state
  const [followupText, setFollowupText] = useState('');
  const [savingFollowup, setSavingFollowup] = useState(false);
  const [followupSaved, setFollowupSaved] = useState(false);

  // Load sample sponsors list for the selector
  useEffect(() => {
    const loadSponsors = async () => {
      try {
        const res = await api.getSponsors({ limit: 100 });
        if (res?.sponsors?.length) {
          setSponsors(res.sponsors);
          const first = res.sponsors[0];
          setSelectedSponsorId(first.id);
          setSelectedCompanyName(first.display_name || first.company_name);
        }
      } catch (err) {
        console.error('Failed to load sponsors list for template preview', err);
      }
    };
    loadSponsors();

    // Load follow-up template
    const loadFollowup = async () => {
      try {
        const res: any = await fetch('/api/templates/followup').then((r) => r.json());
        if (res.template) setFollowupText(res.template);
      } catch (err) {
        console.error('Failed to load follow-up template', err);
      }
    };
    loadFollowup();
  }, []);

  // Fetch DOCX bytes and render preview whenever selected sponsor changes
  useEffect(() => {
    if (activeSubTab !== 'letter') return;

    const fetchLetter = async () => {
      try {
        setLetterLoading(true);
        const url = selectedSponsorId
          ? `/api/templates/letter/preview?sponsor_id=${selectedSponsorId}`
          : `/api/templates/letter/preview?company_name=${encodeURIComponent(selectedCompanyName)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to generate letter preview');

        const refNo = res.headers.get('X-Letter-Ref-No') || '';
        const dateText = res.headers.get('X-Letter-Date') || '';
        setLetterRefNo(refNo);
        setLetterDateText(dateText);

        const blob = await res.blob();
        setLetterBlob(blob);

        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = '';
          await docx.renderAsync(blob, docxContainerRef.current, undefined, {
            className: 'docx-preview-output',
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
          });
        }
      } catch (err) {
        console.error('Error rendering docx preview:', err);
      } finally {
        setLetterLoading(false);
      }
    };

    fetchLetter();
  }, [selectedSponsorId, selectedCompanyName, activeSubTab]);

  const handleSponsorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      setSelectedSponsorId('');
      setSelectedCompanyName('TEST & CO. SDN BHD');
    } else {
      const id = parseInt(val, 10);
      setSelectedSponsorId(id);
      const found = sponsors.find((s) => s.id === id);
      if (found) {
        setSelectedCompanyName(found.display_name || found.company_name);
      }
    }
  };

  const copyEmailScript = () => {
    const customizedBody = VERBATIM_EMAIL_BODY_TEXT.replace(
      /\[Company Name\]/g,
      selectedCompanyName || '[Company Name]'
    );
    const fullText = `Subject: ${VERBATIM_EMAIL_SUBJECT}\n\n${customizedBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadDocx = () => {
    if (!letterBlob) return;
    const url = URL.createObjectURL(letterBlob);
    const a = document.createElement('a');
    a.href = url;
    const safeSlug = (selectedCompanyName || 'Letter')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');
    a.download = `HOPE_5_0_Sponsorship_Letter_${safeSlug}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveFollowup = async () => {
    try {
      setSavingFollowup(true);
      await fetch('/api/templates/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: followupText }),
      });
      setFollowupSaved(true);
      setTimeout(() => setFollowupSaved(false), 2500);
    } catch (err: any) {
      alert(`Failed to save follow-up template: ${err.message}`);
    } finally {
      setSavingFollowup(false);
    }
  };

  const currentEmailBody = VERBATIM_EMAIL_BODY_TEXT.replace(
    /\[Company Name\]/g,
    selectedCompanyName || '[Company Name]'
  );

  return (
    <div className="space-y-4">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex space-x-1.5">
          <button
            onClick={() => setActiveSubTab('letter')}
            className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'letter'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Sponsorship Letter (.docx)
          </button>

          <button
            onClick={() => setActiveSubTab('email')}
            className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'email'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" />
            Email Script (Verbatim)
          </button>

          <button
            onClick={() => setActiveSubTab('proposal')}
            className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'proposal'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            Proposal PDF
          </button>

          <button
            onClick={() => setActiveSubTab('followup')}
            className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'followup'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Follow-up Template
          </button>
        </div>

        {/* Company Selector for live substitution */}
        {(activeSubTab === 'letter' || activeSubTab === 'email') && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 hidden sm:inline">Preview Company:</span>
            <select
              value={selectedSponsorId}
              onChange={handleSponsorSelect}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 max-w-[240px] truncate"
            >
              <option value="">Default: TEST &amp; CO. SDN BHD</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.seq}. {s.display_name || s.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. Letter Preview Sub-tab */}
      {activeSubTab === 'letter' && (
        <div className="space-y-4">
          {/* Header Info & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                  {letterRefNo || 'USM/SSI2627/HOPE/SLF/...'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                  Date: {letterDateText || 'Today in MYT'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Preview, dated today. The final date is stamped when the email is sent.
              </p>
            </div>

            <button
              onClick={downloadDocx}
              disabled={!letterBlob}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download .docx
            </button>
          </div>

          {/* Rendered DOCX Viewport */}
          <div className="bg-slate-200 dark:bg-slate-950 p-4 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto min-h-[600px] flex justify-center">
            {letterLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mb-2" />
                Generating live DOCX letter for {selectedCompanyName}...
              </div>
            ) : (
              <div
                ref={docxContainerRef}
                className="bg-white shadow-xl max-w-4xl w-full p-8 text-slate-900 rounded"
                style={{ minHeight: '800px' }}
              />
            )}
          </div>
        </div>
      )}

      {/* 2. Email Script Sub-tab */}
      {activeSubTab === 'email' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Verbatim Outreach Copy
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                Subject: {VERBATIM_EMAIL_SUBJECT}
              </h3>
            </div>

            <button
              onClick={copyEmailScript}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 text-xs font-medium transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Text
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
            {currentEmailBody}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>
              Standing Rule: Templates are sacred. Never edit or re-flow email copy. Only [Company Name] changes.
            </span>
          </div>
        </div>
      )}

      {/* 3. Proposal PDF Sub-tab */}
      {activeSubTab === 'proposal' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sponsor_Proposal_HOPE_5_0.pdf
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Static binary asset from R2. Attached byte-for-byte unchanged to all outreach emails.
              </p>
            </div>

            <a
              href="/api/templates/proposal"
              download="Sponsor_Proposal_HOPE_5_0.pdf"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download PDF
            </a>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <iframe
              src="/api/templates/proposal"
              className="w-full h-[750px] border-0"
              title="HOPE 5.0 Proposal PDF Viewer"
            />
          </div>
        </div>
      )}

      {/* 4. Follow-up Template Sub-tab */}
      {activeSubTab === 'followup' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Follow-up Email Template (In-Thread Re:)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sent in the same Gmail thread (In-Reply-To and References, Re: subject). Empty and disabled until team pastes wording.
              </p>
            </div>

            <button
              onClick={handleSaveFollowup}
              disabled={savingFollowup}
              className="inline-flex items-center px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {savingFollowup ? 'Saving...' : 'Save Follow-up Template'}
            </button>
          </div>

          <div>
            <textarea
              rows={12}
              value={followupText}
              onChange={(e) => setFollowupText(e.target.value)}
              placeholder="Paste the approved team follow-up wording here... (Supports [Company Name] and [Recipient Name] placeholders)"
              className="w-full p-4 text-xs font-mono bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">
              {followupText.trim().length === 0
                ? 'Follow-up sending is currently disabled because no wording is set.'
                : `${followupText.length} characters configured.`}
            </span>
            {followupSaved && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Template updated successfully!
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
