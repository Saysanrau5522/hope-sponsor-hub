export type SponsorStage =
  | 'not_contacted'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'opened'
  | 'replied'
  | 'in_discussion'
  | 'committed'
  | 'received'
  | 'declined'
  | 'bounced'
  | 'invalid'
  | 'do_not_contact';

export type EmailStatus =
  | 'valid'
  | 'no_email'
  | 'invalid_format'
  | 'no_mx'
  | 'shared_inbox'
  | 'suspicious_domain'
  | 'bounced_hard'
  | 'bounced_soft';

export type ContactQuality = 'csr_or_foundation' | 'generic_inbox' | 'standard';

export interface Sponsor {
  id: number;
  seq: number;
  ref_no: string;
  company_name: string;
  display_name: string;
  type: string | null;
  primary_email: string | null;
  alt_emails: string | null;
  email_raw: string | null;
  phone: string | null;
  website: string | null;
  flags: string | null;
  email_status: EmailStatus;
  contact_quality: ContactQuality;
  shared_with_company: string | null;
  stage: SponsorStage;
  owner: string | null;
  notes: string | null;
  do_not_contact: number;
  already_contacted_date: string | null;
  pledge_tier: string | null;
  pledge_amount: number;
  in_kind_description: string | null;
  pledge_received_amount: number;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Derived fields computed on the fly
  needs_followup?: boolean;
  followup_day?: number;
  followup_count?: number;
  is_hot_lead?: boolean;
  likely_human_opens?: number;
  raw_opens?: number;
  last_email_date?: string | null;
  last_reply_snippet?: string | null;
}

export interface Outreach {
  id: number;
  sponsor_id: number;
  type: 'initial' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3';
  ref_no: string;
  recipient_email: string;
  subject: string;
  letter_date_text: string;
  letter_r2_path: string | null;
  rfc822_message_id: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  tracking_token: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  failed_reason: string | null;
  sent_at: string | null;
  created_at: string;
}

export type OpenClassification = 'ignored_early' | 'possible_prefetch' | 'likely_human';

export interface OpenEvent {
  id: number;
  tracking_token: string;
  sponsor_id: number | null;
  outreach_id: number | null;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
  asn: number | null;
  classification: OpenClassification;
  created_at: string;
}

export interface ReplyBounce {
  id: number;
  sponsor_id: number | null;
  outreach_id: number | null;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  type: 'reply' | 'possible_reply' | 'bounce_hard' | 'bounce_soft' | 'auto_reply';
  sender: string;
  snippet: string | null;
  status_code: string | null;
  parsed_reason: string | null;
  outcome: 'interested' | 'need_more_info' | 'declined' | 'committed' | null;
  received_at: string;
}

export interface CallLog {
  id: number;
  sponsor_id: number;
  caller: string;
  outcome: string;
  notes: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  sponsor_id: number | null;
  actor_email: string;
  action: string;
  details: string | null;
  created_at: string;
}

export interface AuthUser {
  email: string;
  name?: string;
  role: 'admin' | 'member';
}
