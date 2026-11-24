import "server-only";
import { env } from "@/server/env";
import { resolveDelivery } from "./config";

export { escapeHtml } from "./templates";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface SendResult {
  delivered: boolean;
  /** Why nothing was delivered (switched off, console driver). */
  reason?: string;
}

/**
 * Sends one email.
 * 1. SMTP saved in Settings → Email settings (when a host is set): used when switched on;
 *    when switched off nothing is sent.
 * 2. Otherwise the EMAIL_DRIVER environment settings (console / smtp / resend).
 * Throws on delivery failure so callers can log and retry.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const to = Array.isArray(message.to) ? message.to : [message.to];
  if (to.length === 0) return { delivered: false, reason: "No recipients" };

  const delivery = await resolveDelivery();
  if (delivery.mode === "off") {
    console.info(`[email:off] not sent (sending is switched off) to=${to.join(",")} subject="${message.subject}"`);
    return { delivered: false, reason: "Email sending is switched off in Settings → Email settings." };
  }
  if (delivery.mode === "db") {
    const nodemailer = await import("nodemailer");
    const t = delivery.transport;
    const transport = nodemailer.createTransport({
      host: t.host, port: t.port, secure: t.secure, requireTLS: t.requireTLS, ignoreTLS: t.ignoreTLS, auth: t.auth,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
    await transport.sendMail({ from: t.from, to, subject: message.subject, text: message.text, html: message.html, replyTo: message.replyTo ?? t.replyTo });
    return { delivered: true };
  }

  switch (env.EMAIL_DRIVER) {
    case "console": {
      console.info(`[email:console] to=${to.join(",")} subject="${message.subject}"\n${message.text}`);
      return { delivered: false, reason: "No SMTP server is set up yet. The email was only printed to the server log." };
    }
    case "smtp": {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST?.trim().toLowerCase() === "localhost" ? "127.0.0.1" : env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      });
      await transport.sendMail({ from: env.EMAIL_FROM, to, subject: message.subject, text: message.text, html: message.html, replyTo: message.replyTo });
      return { delivered: true };
    }
    case "resend": {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM, to, subject: message.subject, text: message.text, html: message.html, reply_to: message.replyTo }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { delivered: true };
    }
  }
}
