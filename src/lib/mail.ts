import nodemailer from 'nodemailer';
// Plain-text transactional mail over SMTP (Gmail app password works). Only used for backup-email codes/links and security notices; sign-up and reset mails are sent by Supabase itself.
export const mailConfigured = () => !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
export async function sendMail(to: string, subject: string, text: string) {
  const port = Number(process.env.SMTP_PORT || 465), user = process.env.SMTP_USER!;
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, auth: { user, pass: process.env.SMTP_PASS! }, connectionTimeout: 8000, socketTimeout: 12000 });
  await t.sendMail({ from: process.env.SMTP_FROM || `Pera <${user}>`, to, subject, text });
}
