/**
 * HOPE Sponsor Hub - Reply & Bounce Classification and Parsing Logic
 */

export interface IncomingHeader {
  name: string;
  value: string;
}

export interface ClassifiedMessage {
  type: 'reply' | 'possible_reply' | 'bounce_hard' | 'bounce_soft' | 'auto_reply';
  statusCode: string | null;
  parsedReason: string | null;
  sender: string;
  subject: string;
  snippet: string;
  inReplyTo: string | null;
  references: string | null;
  dateStr: string | null;
  failedRecipient: string | null;
}

/**
 * Extracts a clean email address from a RFC 822 From/To string (e.g. 'John Doe <john@example.com>' -> 'john@example.com')
 */
export function extractEmailAddress(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return raw.replace(/["']/g, '').trim().toLowerCase();
}

/**
 * Normalizes headers array or map into a case-insensitive lookup helper
 */
export function getHeaderValue(
  headers: IncomingHeader[] | Record<string, string>,
  headerName: string
): string | null {
  const target = headerName.toLowerCase();
  if (Array.isArray(headers)) {
    const found = headers.find((h) => h.name.toLowerCase() === target);
    return found ? found.value : null;
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return null;
}

/**
 * Classifies an incoming email message based on its headers, snippet, and optional body text
 */
export function classifyIncomingMessage(input: {
  headers: IncomingHeader[] | Record<string, string>;
  snippet?: string;
  bodyText?: string;
}): ClassifiedMessage {
  const headers = input.headers;
  const snippet = (input.snippet || '').trim();
  const bodyText = (input.bodyText || snippet).trim();

  const from = getHeaderValue(headers, 'from') || '';
  const subject = getHeaderValue(headers, 'subject') || '';
  const autoSubmitted = (getHeaderValue(headers, 'auto-submitted') || '').toLowerCase();
  const xAutoReply = (getHeaderValue(headers, 'x-autoreply') || '').toLowerCase();
  const precedence = (getHeaderValue(headers, 'precedence') || '').toLowerCase();
  const inReplyTo = getHeaderValue(headers, 'in-reply-to');
  const references = getHeaderValue(headers, 'references');
  const dateStr = getHeaderValue(headers, 'date');
  const xFailedRecipients = getHeaderValue(headers, 'x-failed-recipients');

  const senderEmail = extractEmailAddress(from);
  const subjectLower = subject.toLowerCase();
  const fromLower = from.toLowerCase();

  // 1. Detect Bounces
  const isMailerDaemon =
    fromLower.includes('mailer-daemon') ||
    fromLower.includes('postmaster') ||
    senderEmail.startsWith('mailer-daemon@') ||
    senderEmail.startsWith('postmaster@');

  const hasBounceSubject =
    subjectLower.includes('delivery status notification (failure)') ||
    subjectLower.includes('undeliverable:') ||
    subjectLower.includes('delivery failure') ||
    subjectLower.includes('failure notice') ||
    subjectLower.includes('mail delivery failed') ||
    subjectLower.includes('returned mail: see transcript');

  if (isMailerDaemon || hasBounceSubject || xFailedRecipients) {
    // Extract recipient if possible
    let failedRecipient = xFailedRecipients ? extractEmailAddress(xFailedRecipients) : null;
    if (!failedRecipient) {
      // Look for recipient in bodyText/snippet
      const recMatch = bodyText.match(/<(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/i) ||
                       bodyText.match(/to:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) ||
                       bodyText.match(/failed:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (recMatch) {
        failedRecipient = recMatch[1].toLowerCase();
      }
    }

    // Check for 5.x.x status code (Hard Bounce)
    const hardStatusMatch = bodyText.match(/5\.\d+\.\d+/) || subject.match(/5\.\d+\.\d+/);
    // Check for 4.x.x status code (Soft Bounce)
    const softStatusMatch = bodyText.match(/4\.\d+\.\d+/) || subject.match(/4\.\d+\.\d+/);

    if (softStatusMatch && !hardStatusMatch) {
      return {
        type: 'bounce_soft',
        statusCode: softStatusMatch[0],
        parsedReason: `Soft bounce (${softStatusMatch[0]})`,
        sender: senderEmail || from,
        subject,
        snippet: snippet.slice(0, 200),
        inReplyTo,
        references,
        dateStr,
        failedRecipient,
      };
    }

    const statusCode = hardStatusMatch ? hardStatusMatch[0] : '5.0.0';
    return {
      type: 'bounce_hard',
      statusCode,
      parsedReason: `Delivery failure (${statusCode})`,
      sender: senderEmail || from,
      subject,
      snippet: snippet.slice(0, 200),
      inReplyTo,
      references,
      dateStr,
      failedRecipient,
    };
  }

  // 2. Detect Out-of-Office / Auto-Reply
  const isAutoSubmitted = autoSubmitted !== '' && autoSubmitted !== 'no';
  const isXAutoReply = xAutoReply === 'yes' || xAutoReply === 'true';
  const isAutoPrecedence = precedence === 'auto_reply';
  const hasAutoSubject =
    subjectLower.startsWith('automatic reply:') ||
    subjectLower.startsWith('out of office:') ||
    subjectLower.startsWith('out of office') ||
    subjectLower.startsWith('auto:') ||
    subjectLower.startsWith('autoreply:') ||
    subjectLower.includes('automated response');

  if (isAutoSubmitted || isXAutoReply || isAutoPrecedence || hasAutoSubject) {
    return {
      type: 'auto_reply',
      statusCode: null,
      parsedReason: 'Out-of-office / automated responder',
      sender: senderEmail || from,
      subject,
      snippet: snippet.slice(0, 200),
      inReplyTo,
      references,
      dateStr,
      failedRecipient: null,
    };
  }

  // 3. Human Reply
  return {
    type: 'reply',
    statusCode: null,
    parsedReason: null,
    sender: senderEmail || from,
    subject,
    snippet: snippet.slice(0, 200),
    inReplyTo,
    references,
    dateStr,
    failedRecipient: null,
  };
}

/**
 * Builds a direct Gmail web deep-link to a message or thread
 */
export function buildGmailDeepLink(messageId: string, threadId?: string | null): string {
  if (threadId) {
    return `https://mail.google.com/mail/u/0/#all/${threadId}`;
  }
  return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
}
