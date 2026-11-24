import "server-only";
import { z } from "zod";

/**
 * Validated server environment. Importing this module throws at boot if a
 * required variable is missing or malformed. Nothing here is ever sent to the
 * browser; public values are exposed only via NEXT_PUBLIC_* in src/lib/public-env.ts.
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    APP_URL: z.string().url().default("http://localhost:3000"),
    /** 32+ random bytes; used to hash IPs and sign preview tokens. */
    APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
    CRON_SECRET: z.string().min(16).optional(),

    STORAGE_DRIVER: z.enum(["local", "azure", "s3"]).default("local"),
    AZURE_STORAGE_ACCOUNT: z.string().optional(),
    AZURE_STORAGE_KEY: z.string().optional(),
    AZURE_STORAGE_CONTAINER: z.string().optional(),
    STORAGE_PUBLIC_URL: z.string().url().optional(),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),

    EMAIL_DRIVER: z.enum(["console", "smtp", "resend"]).default("console"),
    EMAIL_FROM: z.string().default("Cadgram <no-reply@localhost>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),

    LEADS_WEBHOOK_URL: z.string().url().optional(),
    LEADS_WEBHOOK_SECRET: z.string().optional(),
    SLACK_LEADS_WEBHOOK_URL: z.string().url().optional(),

    /** Browser push (Web Push / VAPID). Optional: keys are generated and stored (encrypted) on first use when unset. */
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    /** Contact for push services, e.g. mailto:admin@yourdomain.com */
    VAPID_SUBJECT: z.string().optional(),

    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
    MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(10),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "STORAGE_PUBLIC_URL"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
      }
    }
    if (env.STORAGE_DRIVER === "azure") {
      for (const key of ["AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_KEY", "AZURE_STORAGE_CONTAINER"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=azure` });
      }
    }
    if (env.EMAIL_DRIVER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST is required when EMAIL_DRIVER=smtp" });
    }
    if (env.EMAIL_DRIVER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "RESEND_API_KEY is required when EMAIL_DRIVER=resend" });
    }
  });

// Blank values in .env (KEY="") mean "not set", so optional settings can stay empty.
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
