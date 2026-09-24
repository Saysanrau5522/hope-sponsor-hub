import type { Sponsor } from '@/shared/types';

export interface SponsorListResponse {
  sponsors: Sponsor[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProblemsResponse {
  counts: {
    no_email: number;
    invalid_format: number;
    no_mx: number;
    bounced: number;
    shared_inbox: number;
    suspicious_or_freemail: number;
    send_failures: number;
  };
  activeTab: string;
  items: Sponsor[];
}

export interface ValidationChunkResponse {
  processed: number;
  remaining: number;
  completed: boolean;
  message?: string;
  updated?: Array<{ id: number; company: string; email: string; status: string }>;
}

export const api = {
  async getAuthMe() {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Failed to fetch user session');
    return res.json();
  },

  async getSponsors(params: Record<string, string | number> = {}): Promise<SponsorListResponse> {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') {
        searchParams.set(k, String(v));
      }
    }
    const res = await fetch(`/api/sponsors?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch sponsors');
    return res.json();
  },

  async getSponsor(id: number) {
    const res = await fetch(`/api/sponsors/${id}`);
    if (!res.ok) throw new Error('Failed to fetch sponsor details');
    return res.json();
  },

  async updateSponsor(id: number, data: Partial<Sponsor>) {
    const res = await fetch(`/api/sponsors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update sponsor');
    return res.json();
  },

  async bulkActions(action: string, sponsor_ids: number[], extra: any = {}) {
    const res = await fetch('/api/sponsors/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sponsor_ids, ...extra }),
    });
    if (!res.ok) throw new Error('Failed to perform bulk action');
    return res.json();
  },

  async getProblems(tab = 'no_email'): Promise<ProblemsResponse> {
    const res = await fetch(`/api/problems?tab=${tab}`);
    if (!res.ok) throw new Error('Failed to fetch problems');
    return res.json();
  },

  async fixEmail(sponsor_id: number, new_email: string, queue_now = true) {
    const res = await fetch('/api/problems/fix-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsor_id, new_email, queue_now }),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fix email');
    }
    return res.json();
  },

  async getValidationStatus() {
    const res = await fetch('/api/validate/status');
    if (!res.ok) throw new Error('Failed to fetch validation status');
    return res.json();
  },

  async runValidationChunk(): Promise<ValidationChunkResponse> {
    const res = await fetch('/api/validate/chunk', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run validation chunk');
    return res.json();
  },

  // Phase 5: Replies & Calls APIs
  async getReplies(type = 'all', page = 1, limit = 50) {
    const res = await fetch(`/api/replies?type=${type}&page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch replies');
    return res.json();
  },

  async pollReplies() {
    const res = await fetch('/api/replies/poll', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to poll inbox');
    return res.json();
  },

  async updateReply(id: number, data: { outcome?: string; notes?: string }) {
    const res = await fetch(`/api/replies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update reply');
    return res.json();
  },

  async getCallQueue() {
    const res = await fetch('/api/calls/queue');
    if (!res.ok) throw new Error('Failed to fetch call queue');
    return res.json();
  },

  async getCalls(sponsor_id?: number) {
    const url = sponsor_id ? `/api/calls?sponsor_id=${sponsor_id}` : '/api/calls';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch calls');
    return res.json();
  },

  async logCall(data: {
    sponsor_id: number;
    caller: string;
    outcome: string;
    notes?: string;
    callback_date?: string;
    pledge_tier?: string;
    pledge_amount?: number;
    in_kind_description?: string;
    stage_update?: string;
  }) {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to log call');
    }
    return res.json();
  },

  // Phase 6: Analytics & Settings APIs
  async getOverviewAnalytics() {
    const res = await fetch('/api/analytics/overview');
    if (!res.ok) throw new Error('Failed to fetch overview analytics');
    return res.json();
  },

  async getSettings() {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(data: Record<string, any>) {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async triggerBackup() {
    const res = await fetch('/api/settings/backup', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger backup');
    return res.json();
  },

  async getBackups() {
    const res = await fetch('/api/settings/backups');
    if (!res.ok) throw new Error('Failed to fetch backups list');
    return res.json();
  },
};

