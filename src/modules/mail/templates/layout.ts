/**
 * Template rendering helpers.
 *
 * Templates are plain functions returning strings, not a template engine. The
 * only thing an engine would add here is interpolation, and the one thing it
 * would cost is a dependency plus a way to run unescaped by default.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapes text for an HTML body or an attribute.
 *
 * Not optional. A template interpolates a first name, a device label and a
 * reason, all of which are user controlled, so anything interpolated as
 * markup without this is a stored injection in a mail client.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export interface LayoutData {
  appName: string;
  /** The plain-text body, already assembled. */
  text: string;
  /** The inner html, already escaped by the template. */
  html: string;
}

/**
 * Wraps both parts in the same visual shell.
 *
 * The text part is not a stripped version of the html: a mail client that shows
 * neither formatting nor images still has to show the link, so the text part
 * carries the full content and the html part carries the layout.
 */
export function layout(data: LayoutData): { text: string; html: string } {
  const { appName, text, html } = data;

  const htmlBody = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(appName)}</title>
</head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2933;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;">
<tr><td style="padding:24px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${escapeHtml(appName)}</h1>
${html}
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e4e7eb;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#616e7c;">
This is an automated message. Replies are not read.
</p>
</td></tr>
</table>
</body>
</html>`;

  const textBody = `${text}

--
${appName}
This is an automated message. Replies are not read.`;

  return { text: textBody, html: htmlBody };
}

/** A primary call-to-action button, plus the bare url for the text part. */
export function actionLink(
  url: string,
  label: string,
): { html: string; text: string } {
  return {
    html: `<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;">${escapeHtml(label)}</a></p>
<p style="margin:0;font-size:13px;color:#52606d;word-break:break-all;">Or paste this into your browser:<br>${escapeHtml(url)}</p>`,
    text: `${label}: ${url}`,
  };
}
