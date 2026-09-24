import { describe, it, expect } from 'vitest';
import {
  classifyIncomingMessage,
  extractEmailAddress,
  buildGmailDeepLink,
} from '../src/shared/replies';
import { calendarDaysDiffMYT } from '../src/shared/time';

describe('Phase 5: Reply, Bounce & Follow-up Logic', () => {
  describe('Classification of Incoming Messages', () => {
    it('classifies a genuine human response as a reply', () => {
      const message = {
        headers: [
          { name: 'From', value: 'Datin Sharmini <sharmini@corporate.com.my>' },
          { name: 'Subject', value: 'Re: REQUEST FOR SPONSORSHIP FOR HOPE 5.0 — CHASE THE LIGHT' },
          { name: 'In-Reply-To', value: '<hope-42_1774421111@hope-sponsor-hub>' },
          { name: 'References', value: '<hope-42_1774421111@hope-sponsor-hub>' },
          { name: 'Date', value: 'Fri, 25 Sep 2026 10:15:00 +0800' },
        ],
        snippet: 'Hi HOPE team, we received your proposal and would like to schedule a call next Tuesday.',
      };

      const classified = classifyIncomingMessage(message);
      expect(classified.type).toBe('reply');
      expect(classified.sender).toBe('sharmini@corporate.com.my');
      expect(classified.inReplyTo).toBe('<hope-42_1774421111@hope-sponsor-hub>');
      expect(classified.snippet).toContain('schedule a call next Tuesday');
      expect(classified.statusCode).toBeNull();
    });

    it('classifies out-of-office automated emails as auto_reply (does not mark sponsor replied)', () => {
      // Scenario A: Auto-Submitted header
      const msgAutoSubmitted = {
        headers: [
          { name: 'From', value: 'Tan Sri Lim <tslim@group.my>' },
          { name: 'Subject', value: 'Automatic reply: Away on annual leave' },
          { name: 'Auto-Submitted', value: 'auto-replied' },
          { name: 'Date', value: 'Fri, 25 Sep 2026 11:00:00 +0800' },
        ],
        snippet: 'I am currently out of office until 5 October. For urgent matters please contact my assistant.',
      };

      const classA = classifyIncomingMessage(msgAutoSubmitted);
      expect(classA.type).toBe('auto_reply');
      expect(classA.parsedReason).toBe('Out-of-office / automated responder');

      // Scenario B: Subject with "Out of office"
      const msgOooSubject = {
        headers: [
          { name: 'From', value: 'CSR Office <csr@bank.com.my>' },
          { name: 'Subject', value: 'Out of Office: Thank you for your email' },
          { name: 'Date', value: 'Fri, 25 Sep 2026 11:05:00 +0800' },
        ],
        snippet: 'Thank you for reaching out. We will review inquiries when we resume next week.',
      };

      const classB = classifyIncomingMessage(msgOooSubject);
      expect(classB.type).toBe('auto_reply');
    });

    it('classifies 5.x.x permanent delivery failures as bounce_hard with recipient extraction', () => {
      const bounceMsg = {
        headers: [
          { name: 'From', value: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>' },
          { name: 'Subject', value: 'Delivery Status Notification (Failure)' },
          { name: 'X-Failed-Recipients', value: 'invalid_hr@unknown-corp.com.my' },
          { name: 'Date', value: 'Fri, 25 Sep 2026 09:30:00 +0800' },
        ],
        snippet: '550-5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient address.',
        bodyText: `
          ** Address not found **
          Your message wasn't delivered to invalid_hr@unknown-corp.com.my because the address couldn't be found, or is unable to receive mail.
          The response from the remote server was:
          550 5.1.1 <invalid_hr@unknown-corp.com.my>: Recipient address rejected: User unknown in virtual mailbox table
        `,
      };

      const classified = classifyIncomingMessage(bounceMsg);
      expect(classified.type).toBe('bounce_hard');
      expect(classified.statusCode).toBe('5.1.1');
      expect(classified.failedRecipient).toBe('invalid_hr@unknown-corp.com.my');
      expect(classified.parsedReason).toContain('Delivery failure (5.1.1)');
    });

    it('classifies 4.x.x temporary delivery failures as bounce_soft', () => {
      const softBounceMsg = {
        headers: [
          { name: 'From', value: 'postmaster@partner.org.my' },
          { name: 'Subject', value: 'Undeliverable: REQUEST FOR SPONSORSHIP' },
          { name: 'Date', value: 'Fri, 25 Sep 2026 09:45:00 +0800' },
        ],
        snippet: 'Delivery delayed: recipient mailbox is temporarily over quota (4.2.2).',
        bodyText: 'Diagnostic-Code: smtp; 452 4.2.2 Mailbox is full / quota exceeded',
      };

      const classified = classifyIncomingMessage(softBounceMsg);
      expect(classified.type).toBe('bounce_soft');
      expect(classified.statusCode).toBe('4.2.2');
      expect(classified.parsedReason).toBe('Soft bounce (4.2.2)');
    });
  });

  describe('Follow-up Badge & Date Calculation (7 Calendar Days MYT)', () => {
    it('accurately identifies follow-up due at >= 7 calendar days in MYT', () => {
      // Outreach sent on 2026-09-17 at 10:00 MYT (UTC+8)
      const sentDate = new Date('2026-09-17T02:00:00Z'); // 10:00 MYT

      // 6 days later: 2026-09-23
      const day6 = new Date('2026-09-23T02:00:00Z');
      expect(calendarDaysDiffMYT(sentDate, day6)).toBe(6);

      // Exactly 7 days later: 2026-09-24
      const day7 = new Date('2026-09-24T02:00:00Z');
      expect(calendarDaysDiffMYT(sentDate, day7)).toBe(7);

      // 10 days later: 2026-09-27
      const day10 = new Date('2026-09-27T02:00:00Z');
      expect(calendarDaysDiffMYT(sentDate, day10)).toBe(10);
    });

    it('respects follow-up constraints: max 3 follow-ups and skips if already replied or bounced', () => {
      const now = new Date('2026-09-25T10:00:00+08:00');

      function checkNeedsFollowup(sponsor: {
        stage: string;
        realReplies: number;
        lastEmailDate: string;
        sentCount: number;
        emailStatus: string;
        doNotContact: number;
      }): boolean {
        if (
          (sponsor.stage === 'sent' || sponsor.stage === 'opened') &&
          sponsor.realReplies === 0 &&
          sponsor.doNotContact === 0 &&
          sponsor.emailStatus !== 'bounced_hard' &&
          sponsor.emailStatus !== 'bounced_soft'
        ) {
          const days = calendarDaysDiffMYT(new Date(sponsor.lastEmailDate), now);
          return days >= 7 && sponsor.sentCount <= 3;
        }
        return false;
      }

      // Case 1: 8 days ago, 1 sent, no reply -> YES
      expect(
        checkNeedsFollowup({
          stage: 'sent',
          realReplies: 0,
          lastEmailDate: '2026-09-17T10:00:00+08:00',
          sentCount: 1,
          emailStatus: 'valid',
          doNotContact: 0,
        })
      ).toBe(true);

      // Case 2: 8 days ago, but already replied -> NO
      expect(
        checkNeedsFollowup({
          stage: 'replied',
          realReplies: 1,
          lastEmailDate: '2026-09-17T10:00:00+08:00',
          sentCount: 1,
          emailStatus: 'valid',
          doNotContact: 0,
        })
      ).toBe(false);

      // Case 3: 8 days ago, but already sent 4 emails (initial + 3 follow-ups max reached) -> NO
      expect(
        checkNeedsFollowup({
          stage: 'opened',
          realReplies: 0,
          lastEmailDate: '2026-09-17T10:00:00+08:00',
          sentCount: 4,
          emailStatus: 'valid',
          doNotContact: 0,
        })
      ).toBe(false);

      // Case 4: 8 days ago, but email hard-bounced -> NO
      expect(
        checkNeedsFollowup({
          stage: 'bounced',
          realReplies: 0,
          lastEmailDate: '2026-09-17T10:00:00+08:00',
          sentCount: 1,
          emailStatus: 'bounced_hard',
          doNotContact: 0,
        })
      ).toBe(false);
    });
  });

  describe('Hot Lead Calculation', () => {
    it('flags hot lead if 2 or more human opens in 24 hours without reply', () => {
      function checkIsHotLead(input: {
        opens24h: number;
        realReplies: number;
        doNotContact: number;
        stage: string;
      }): boolean {
        return (
          input.opens24h >= 2 &&
          input.realReplies === 0 &&
          input.doNotContact === 0 &&
          input.stage !== 'declined' &&
          input.stage !== 'committed'
        );
      }

      expect(checkIsHotLead({ opens24h: 2, realReplies: 0, doNotContact: 0, stage: 'opened' })).toBe(true);
      expect(checkIsHotLead({ opens24h: 5, realReplies: 0, doNotContact: 0, stage: 'sent' })).toBe(true);
      expect(checkIsHotLead({ opens24h: 1, realReplies: 0, doNotContact: 0, stage: 'opened' })).toBe(false);
      expect(checkIsHotLead({ opens24h: 3, realReplies: 1, doNotContact: 0, stage: 'replied' })).toBe(false);
    });
  });

  describe('Utility Helpers', () => {
    it('extracts clean email from various header formats', () => {
      expect(extractEmailAddress('Simple <user@test.com>')).toBe('user@test.com');
      expect(extractEmailAddress('"First Last" <User.Name+Tag@Org.MY>')).toBe('user.name+tag@org.my');
      expect(extractEmailAddress('admin@domain.com')).toBe('admin@domain.com');
      expect(extractEmailAddress('')).toBe('');
    });

    it('builds deep link for Gmail web app', () => {
      expect(buildGmailDeepLink('msg_123', 'thread_abc')).toBe('https://mail.google.com/mail/u/0/#all/thread_abc');
      expect(buildGmailDeepLink('msg_123', null)).toBe('https://mail.google.com/mail/u/0/#inbox/msg_123');
    });
  });
});
