/**
 * Optional email via SMTP (nodemailer). Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 */
export async function sendContestEmail(to, prefs = {}) {
  if (!to) return false;
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log('[email] SMTP not configured — would send to', to);
    return false;
  }

  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    console.warn('[email] nodemailer not installed');
    return false;
  }

  const transport = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const from = process.env.SMTP_FROM || 'CP Vault <noreply@cpvault.app>';
  const subject = 'CP Vault — Contest reminders';
  const text =
    prefs.emailBody ||
    'You have upcoming contests in CP Vault. Open your dashboard to see details and enable browser notifications.';

  await transport.sendMail({ from, to, subject, text });
  return true;
}
