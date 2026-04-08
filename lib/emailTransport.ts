import nodemailer from 'nodemailer';

// Gmail transporter — uses App Password from Google Account
// Works on Vercel (port 465 SSL is not blocked)
export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password (16-char, no spaces)
  },
});

/**
 * Thin wrapper so routes don't import nodemailer directly.
 * Usage: await sendEmail({ to, subject, html })
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return transporter.sendMail({
    from: `"My Inventory System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}
