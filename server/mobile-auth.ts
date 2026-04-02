import { createHash, randomBytes } from "node:crypto";

export const mobileAuthTokenTtlDays = 30;

export function hashMobileAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildMobileAuthTokenExpiry(nowMs = Date.now()) {
  return new Date(nowMs + mobileAuthTokenTtlDays * 24 * 60 * 60 * 1000).toISOString();
}

export function createMobileAuthToken() {
  return randomBytes(32).toString("hex");
}

export function parseMobileBearerToken(header?: string) {
  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token;
}
