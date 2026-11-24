import { z } from "zod";
import { isSlug } from "@/lib/utils";
import { phoneProblem, splitPhone } from "@/lib/countries";

export const id = z.string().cuid();
export const optionalId = z.string().cuid().nullish().or(z.literal("").transform(() => null));

export const slug = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80)
  .refine(isSlug, "Use lowercase letters, numbers and hyphens only");

export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const requiredText = (max = 200) => z.string().trim().min(1, "Required").max(max);

export const url = z
  .string()
  .trim()
  .url("Enter a full URL starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed");

export const optionalUrl = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(url.nullable());

/** Relative site path ("/about") or absolute http(s) URL. Rejects javascript: etc. */
export const href = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v) || v.startsWith("mailto:") || v.startsWith("tel:"), "Use a path like /about or a full https:// URL");

export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

/**
 * Mobile number with its country code, as sent by the phone field ("+919876543210"). The national
 * part must have the right number of digits for that country (10 for India, starting 6–9; see
 * lib/countries.ts). Numbers typed without "+" are read as Indian. Saved as "+<code><number>".
 */
export const phone = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .superRefine((v, ctx) => {
    const { country, national } = splitPhone(v);
    const problem = phoneProblem(country, national);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  })
  .transform((v) => {
    const { country, national } = splitPhone(v);
    return `+${country.dial}${national}`;
  });

/** An office phone (a landline with area code is fine), which may be left empty (saved as null). */
export const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null)
  .superRefine((v, ctx) => {
    if (!v) return;
    const { country, national } = splitPhone(v);
    const problem = phoneProblem(country, national, { mobile: false });
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  })
  .transform((v) => {
    if (!v) return null;
    const { country, national } = splitPhone(v);
    return `+${country.dial}${national}`;
  });

export const money = z.coerce.number().min(0).max(1_000_000_000).nullish();

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const publishStatus = z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]);

export const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const seoInput = z.object({
  title: optionalText(70),
  description: optionalText(170),
  keywords: optionalText(250),
  canonicalUrl: optionalUrl,
  noIndex: z.boolean().default(false),
  ogImageId: optionalId,
});
export type SeoInput = z.infer<typeof seoInput>;

/**
 * Schema for list filters read from the URL (?q=&categoryId=…). Filter forms submit empty dropdowns
 * as "" (e.g. "All categories"), and links can carry repeated or stale values, so blanks are dropped,
 * repeated keys use the first value, and fields wrapped in `.catch()` fall back instead of erroring.
 */
export const urlQuery = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess(
    (raw) =>
      raw && typeof raw === "object"
        ? Object.fromEntries(
            Object.entries(raw as Record<string, unknown>)
              .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as const)
              .filter(([, v]) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "")),
          )
        : raw,
    z.object(shape),
  );
