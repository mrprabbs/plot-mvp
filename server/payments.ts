import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5000";

export const platformFeeBasisPoints = Number.parseInt(process.env.PLATFORM_FEE_BPS || "1500", 10);

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-03-25.dahlia",
    })
  : null;

export function getWebhookSecret() {
  return stripeWebhookSecret;
}

export function getAppBaseUrl() {
  return appBaseUrl;
}

export function calculateBookingAmountCents(
  startTimeIso: string,
  endTimeIso: string,
  pricePerHourCents: number,
) {
  const start = new Date(startTimeIso);
  const end = new Date(endTimeIso);

  const durationMs = end.getTime() - start.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const billableHours = Math.max(1, Math.ceil(durationHours));

  return billableHours * pricePerHourCents;
}

export function calculatePlatformFeeCents(totalCents: number) {
  return Math.round((totalCents * platformFeeBasisPoints) / 10000);
}
