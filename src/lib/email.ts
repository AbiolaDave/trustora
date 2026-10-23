import nodemailer from "nodemailer";
import { env } from "./env";

/**
 * Gmail via an App Password (Google Account > Security > 2-Step Verification > App passwords).
 * Without GMAIL_USER / GMAIL_APP_PASSWORD, emails are printed to the server console in development
 * and clearly labelled, so you can still click verification and reset links.
 */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    if (env.NODE_ENV === "production") console.warn("[email] GMAIL_USER / GMAIL_APP_PASSWORD not set; email not sent.");
    else console.log(`\n[DEV EMAIL - not actually sent]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } });
  await transport.sendMail({ from: `"${env.APP_NAME}" <${env.GMAIL_USER}>`, to, subject, text });
}
