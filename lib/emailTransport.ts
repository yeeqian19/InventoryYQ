import nodemailer from 'nodemailer';

/**
 * Shared Nodemailer transporter.
 * Centralised here so SMTP config only lives in one place.
 * All API routes that send email should import this.
 */
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
