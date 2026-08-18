import {
  ensurePromiseWithResolvers,
  resolvePdfJsModule,
  resolvePdfWorkerSrc,
} from "~/lib/pdfjs-module";

/**
 * Load PDF.js with the legacy build so factory Android tablets (Samsung
 * Internet / older WebView) get polyfills such as Promise.withResolvers.
 * Point the worker at a Vite-emitted URL; `new URL("pdfjs-dist/...", import.meta.url)`
 * is not rewritten and 404s in production.
 */
export async function loadPdfJs() {
  ensurePromiseWithResolvers();
  const [pdfjsModule, workerModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  const pdfjs = resolvePdfJsModule(pdfjsModule);
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfWorkerSrc(workerModule);
  return pdfjs;
}
