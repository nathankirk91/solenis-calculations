/** Canonical production URL for push deep links and absolute URLs. */
export const PRODUCTION_APP_BASE_URL = "https://hercules1612.com";

function toHttpsUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withScheme.replace(/\/$/, "");
}

export function getAppBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return toHttpsUrl(configured);
  }

  const netlifyContext = process.env.CONTEXT?.trim();
  const netlifyUrl = process.env.URL?.trim();
  const deployPrimeUrl = process.env.DEPLOY_PRIME_URL?.trim();

  if (netlifyContext === "production" && netlifyUrl) {
    return toHttpsUrl(netlifyUrl);
  }

  if (deployPrimeUrl) {
    return toHttpsUrl(deployPrimeUrl);
  }

  if (netlifyUrl) {
    return toHttpsUrl(netlifyUrl);
  }

  if (netlifyContext === "production" || process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_BASE_URL;
  }

  return new URL(request.url).origin;
}
