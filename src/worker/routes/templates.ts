import { Hono } from 'hono';
import { WorkerEnv } from '../middleware/access';
import { AuthUser, Sponsor } from '../../shared/types';
import { generateLetter, setCachedTemplate } from '../../shared/letter';
import { VERBATIM_EMAIL_SUBJECT, VERBATIM_EMAIL_BODY_TEXT } from '../../shared/constants';

const templatesRoute = new Hono<{ Bindings: WorkerEnv; Variables: { user: AuthUser } }>();

// In-memory cache for template bytes in worker isolate
let cachedTemplateBytes: Uint8Array | null = null;
let cachedProposalBytes: Uint8Array | null = null;

async function getTemplateBytes(env: WorkerEnv): Promise<Uint8Array> {
  if (cachedTemplateBytes) {
    return cachedTemplateBytes;
  }

  // Attempt to load from R2 bucket
  if (env.BUCKET) {
    const obj = await env.BUCKET.get('assets/template.docx');
    if (obj) {
      cachedTemplateBytes = new Uint8Array(await obj.arrayBuffer());
      setCachedTemplate(cachedTemplateBytes);
      return cachedTemplateBytes;
    }
  }

  throw new Error('Template DOCX not found in R2 bucket');
}

async function getProposalPdfBytes(env: WorkerEnv): Promise<Uint8Array> {
  if (cachedProposalBytes) {
    return cachedProposalBytes;
  }

  if (env.BUCKET) {
    const obj = await env.BUCKET.get('assets/proposal.pdf');
    if (obj) {
      cachedProposalBytes = new Uint8Array(await obj.arrayBuffer());
      return cachedProposalBytes;
    }
  }

  throw new Error('Proposal PDF not found in R2 bucket');
}

// GET /api/templates/email-script - Verbatim email copy
templatesRoute.get('/email-script', async (c) => {
  return c.json({
    subject: VERBATIM_EMAIL_SUBJECT,
    bodyText: VERBATIM_EMAIL_BODY_TEXT,
  });
});

// GET /api/templates/proposal - Proposal PDF stream
templatesRoute.get('/proposal', async (c) => {
  try {
    const pdfBytes = await getProposalPdfBytes(c.env);
    return new Response(pdfBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Sponsor_Proposal_HOPE_5_0.pdf"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return c.json({ error: `Proposal PDF unavailable: ${err.message}` }, 404);
  }
});

// GET /api/templates/letter/preview - Generate live DOCX preview dated today
templatesRoute.get('/letter/preview', async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const sponsorId = url.searchParams.get('sponsor_id');
  const companyNameParam = url.searchParams.get('company_name');

  let companyInput = {
    company_name: 'TEST & CO. SDN BHD',
    display_name: 'TEST & CO. SDN BHD',
    ref_no: 'USM/SSI2627/HOPE/SLF/01',
    seq: 1,
  };

  if (sponsorId) {
    const s = await db.prepare('SELECT * FROM sponsors WHERE id = ?').bind(parseInt(sponsorId, 10)).first<Sponsor>();
    if (s) {
      companyInput = {
        company_name: s.company_name,
        display_name: s.display_name,
        ref_no: s.ref_no,
        seq: s.seq,
      };
    }
  } else if (companyNameParam) {
    companyInput = {
      company_name: companyNameParam,
      display_name: companyNameParam,
      ref_no: 'USM/SSI2627/HOPE/SLF/01',
      seq: 1,
    };
  }

  try {
    const templateBytes = await getTemplateBytes(c.env);
    const { docxBytes, refNo, dateText } = generateLetter(companyInput, new Date(), templateBytes);

    const safeSlug = (companyInput.display_name || companyInput.company_name)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40);
    const filename = `HOPE_5_0_Sponsorship_Letter_${safeSlug}.docx`;

    return new Response(docxBytes as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `inline; filename="${filename}"`,
        'X-Letter-Ref-No': refNo,
        'X-Letter-Date': dateText,
      },
    });
  } catch (err: any) {
    return c.json({ error: `Letter generation error: ${err.message}` }, 500);
  }
});

// GET /api/templates/followup - Get follow-up template
templatesRoute.get('/followup', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'followup_template'").first<{ value: string }>();
  return c.json({
    template: row?.value || '',
  });
});

// POST /api/templates/followup - Update follow-up template
templatesRoute.post('/followup', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ template: string }>();
  const now = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('followup_template', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(body.template || '', now)
    .run();

  await db
    .prepare('INSERT INTO activity_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)')
    .bind(user.email, 'update_followup_template', 'Updated follow-up email template wording', now)
    .run();

  return c.json({ success: true, template: body.template });
});

export default templatesRoute;
