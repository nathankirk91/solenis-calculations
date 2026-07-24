/** Canonical production URL for push deep links and absolute URLs. */
export const PRODUCTION_APP_BASE_URL = "https://solenis-calculations.vercel.app";

export function getAppBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "")}`;
  }

  // Prefer the stable production domain over ephemeral VERCEL_URL preview hosts.
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_BASE_URL;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "")}`;
  }

  return new URL(request.url).origin;
}
