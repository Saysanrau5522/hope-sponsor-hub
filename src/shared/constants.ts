/**
 * Verbatim Email Copy for HOPE 5.0 Sponsorship Outreach
 * NON-NEGOTIABLE: Email copy is used verbatim. Only [Company Name] changes.
 */

export const VERBATIM_EMAIL_SUBJECT = 'REQUEST FOR SPONSORSHIP FOR HOPE 5.0 — CHASE THE LIGHT';

export const VERBATIM_EMAIL_BODY_TEXT = `Dear [Company Name],

We are the Sekretariat Sukarelawan India (SSI), Universiti Sains Malaysia, and we would like to invite you to sponsor HOPE 5.0 — Chase the Light. This annual cancer awareness event will take place tentatively in April 2027 at USM, dedicated to bringing joy and support to pediatric cancer patients, orphanage children, and school children.

By partnering with us, you will support a highly meaningful cause while aligning your brand with community development and youth engagement. We offer various sponsorship tiers and are happy to discuss customized brand promotion that best fits your organization's goals.

Attached for your kind reference are:
Sponsorship Letter
Sponsorship Proposal

Should you have any inquiries or wish to discuss the sponsorship benefits, please contact us at hopebyssi@gmail.com or reach out directly:
Saysanrau A/L Sinniyah - Project Director (+60 19-676 2565)
Tinethran A/L Kanagan - Head of Sponsorship Department (+60 12-934 1465)

Thank you for your time and consideration. We look forward to the opportunity to collaborate with you to make HOPE 5.0 a success.`;

/**
 * Mirror HTML version of the plain text body with structured list and contact lines,
 * ready to accept the tracking pixel image.
 */
export function renderEmailHtml(companyName: string, trackingPixelUrl?: string): string {
  const pixelTag = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b;">
  <p>Dear ${companyName},</p>

  <p>We are the Sekretariat Sukarelawan India (SSI), Universiti Sains Malaysia, and we would like to invite you to sponsor HOPE 5.0 — Chase the Light. This annual cancer awareness event will take place tentatively in April 2027 at USM, dedicated to bringing joy and support to pediatric cancer patients, orphanage children, and school children.</p>

  <p>By partnering with us, you will support a highly meaningful cause while aligning your brand with community development and youth engagement. We offer various sponsorship tiers and are happy to discuss customized brand promotion that best fits your organization's goals.</p>

  <p>Attached for your kind reference are:</p>
  <ul>
    <li>Sponsorship Letter</li>
    <li>Sponsorship Proposal</li>
  </ul>

  <p>Should you have any inquiries or wish to discuss the sponsorship benefits, please contact us at <a href="mailto:hopebyssi@gmail.com">hopebyssi@gmail.com</a> or reach out directly:<br>
  Saysanrau A/L Sinniyah - Project Director (+60 19-676 2565)<br>
  Tinethran A/L Kanagan - Head of Sponsorship Department (+60 12-934 1465)</p>

  <p>Thank you for your time and consideration. We look forward to the opportunity to collaborate with you to make HOPE 5.0 a success.</p>
  ${pixelTag}
</body>
</html>`;
}
