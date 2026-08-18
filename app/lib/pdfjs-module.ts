type PdfJsModule = typeof import("pdfjs-dist");

function isPdfJsModule(value: unknown): value is PdfJsModule {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PdfJsModule>;
  return Boolean(
    candidate.GlobalWorkerOptions && typeof candidate.getDocument === "function",
  );
}

/**
 * Vite/esbuild sometimes wraps ESM as `{ default: module }`. A default import
 * of pdfjs-dist is undefined, which throws
 * `Cannot read properties of undefined (reading 'GlobalWorkerOptions')`.
 */
export function resolvePdfJsModule(module: unknown): PdfJsModule {
  if (isPdfJsModule(module)) {
    return module;
  }
  if (module && typeof module === "object" && "default" in module) {
    const inner = (module as { default: unknown }).default;
    if (isPdfJsModule(inner)) {
      return inner;
    }
  }
  throw new Error("Could not load the PDF viewer.");
}

export function resolvePdfWorkerSrc(module: unknown): string {
  if (typeof module === "string" && module.length > 0) {
    return module;
  }
  if (module && typeof module === "object" && "default" in module) {
    const inner = (module as { default: unknown }).default;
    if (typeof inner === "string" && inner.length > 0) {
      return inner;
    }
  }
  throw new Error("Could not load the PDF worker.");
}

export function ensurePromiseWithResolvers(
  promiseCtor: PromiseConstructor = Promise,
): void {
  const ctor = promiseCtor as PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof ctor.withResolvers === "function") {
    return;
  }
  ctor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export function pdfRenderErrorMessage(cause: unknown): string {
  if (!(cause instanceof Error) || !cause.message.trim()) {
    return "Could not render PDF.";
  }
  if (
    /GlobalWorkerOptions|workerSrc|fake worker|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      cause.message,
    )
  ) {
    return "Could not render PDF on this device. Use Download to open it.";
  }
  return cause.message;
}
