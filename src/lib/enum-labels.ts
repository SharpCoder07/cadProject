/**
 * Website names for pricing models, deployment types and billing periods, taken from Website texts
 * (group “Pricing and deployment names”) so they can be reworded. The admin keeps the built-in names (lib/format).
 */
import { TEXT_DEFAULTS, type T } from "@/lib/site-texts";

const label = (t: T, prefix: string, value: string | null | undefined, fallback = "") => (value && `${prefix}${value}` in TEXT_DEFAULTS ? t(`${prefix}${value}`) : (value ?? fallback));

export const pricingLabel = (t: T, value: string | null | undefined) => label(t, "labels.pricing_", value);
export const deploymentLabel = (t: T, value: string | null | undefined) => label(t, "labels.deployment_", value);
export const billingLabel = (t: T, value: string | null | undefined) => label(t, "labels.billing_", value);
/** [value, label] pairs in the built-in order, for filter lists. */
export const pricingOptions = (t: T) => Object.keys(TEXT_DEFAULTS).filter((k) => k.startsWith("labels.pricing_")).map((k) => [k.slice("labels.pricing_".length), t(k)] as [string, string]);
export const deploymentOptions = (t: T) => Object.keys(TEXT_DEFAULTS).filter((k) => k.startsWith("labels.deployment_")).map((k) => [k.slice("labels.deployment_".length), t(k)] as [string, string]);
