import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// After a deploy, hashed JS chunks change. A tab that stayed open can request
// an old chunk URL and fail. Reload once so the browser picks up the new build.
const RELOAD_KEY = "solenis-chunk-reload-at";

function reloadForStaleAssets() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    if (Number.isFinite(last) && Date.now() - last < 15_000) {
      return;
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage may be unavailable; still attempt a reload.
  }
  window.location.reload();
}

function isChunkLoadFailure(message: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadForStaleAssets();
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";

  if (isChunkLoadFailure(message)) {
    event.preventDefault();
    reloadForStaleAssets();
  }
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
