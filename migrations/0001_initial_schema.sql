-- Migration 0001: Initial Schema for HOPE Sponsor Hub

CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL UNIQUE,
  ref_no TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT,
  primary_email TEXT,
  alt_emails TEXT,
  email_raw TEXT,
  phone TEXT,
  website TEXT,
  flags TEXT,
  email_status TEXT NOT NULL DEFAULT 'no_email',
  contact_quality TEXT DEFAULT 'standard',
  shared_with_company TEXT,
  stage TEXT NOT NULL DEFAULT 'not_contacted',
  owner TEXT,
  notes TEXT,
  do_not_contact INTEGER NOT NULL DEFAULT 0,
  already_contacted_date TEXT,
  pledge_tier TEXT,
  pledge_amount REAL DEFAULT 0,
  in_kind_description TEXT,
  pledge_received_amount REAL DEFAULT 0,
  validated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsors_seq ON sponsors(seq);
CREATE INDEX IF NOT EXISTS idx_sponsors_stage ON sponsors(stage);
CREATE INDEX IF NOT EXISTS idx_sponsors_email_status ON sponsors(email_status);
CREATE INDEX IF NOT EXISTS idx_sponsors_primary_email ON sponsors(primary_email);
CREATE INDEX IF NOT EXISTS idx_sponsors_contact_quality ON sponsors(contact_quality);

CREATE TABLE IF NOT EXISTS outreaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(id),
  type TEXT NOT NULL DEFAULT 'initial',
  ref_no TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  letter_date_text TEXT NOT NULL,
  letter_r2_path TEXT,
  rfc822_message_id TEXT NOT NULL UNIQUE,
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  tracking_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued',
  failed_reason TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outreaches_sponsor_id ON outreaches(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_outreaches_tracking_token ON outreaches(tracking_token);
CREATE INDEX IF NOT EXISTS idx_outreaches_status ON outreaches(status);
CREATE INDEX IF NOT EXISTS idx_outreaches_gmail_thread_id ON outreaches(gmail_thread_id);

CREATE TABLE IF NOT EXISTS open_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_token TEXT NOT NULL,
  sponsor_id INTEGER REFERENCES sponsors(id),
  outreach_id INTEGER REFERENCES outreaches(id),
  ip TEXT,
  user_agent TEXT,
  country TEXT,
  asn INTEGER,
  classification TEXT NOT NULL, -- ignored_early, possible_prefetch, likely_human
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_open_events_token ON open_events(tracking_token);
CREATE INDEX IF NOT EXISTS idx_open_events_sponsor_id ON open_events(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_open_events_created_at ON open_events(created_at);

CREATE TABLE IF NOT EXISTS replies_bounces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_id INTEGER REFERENCES sponsors(id),
  outreach_id INTEGER REFERENCES outreaches(id),
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  type TEXT NOT NULL, -- reply, possible_reply, bounce_hard, bounce_soft, auto_reply
  sender TEXT NOT NULL,
  snippet TEXT,
  status_code TEXT,
  parsed_reason TEXT,
  outcome TEXT, -- interested, need_more_info, declined, committed
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replies_sponsor_id ON replies_bounces(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_replies_thread_id ON replies_bounces(gmail_thread_id);

CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(id),
  caller TEXT NOT NULL,
  outcome TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_sponsor_id ON calls(sponsor_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_id INTEGER REFERENCES sponsors(id),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_sponsor_id ON activity_logs(sponsor_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
