import assert from "node:assert/strict";

const {
  ensurePromiseWithResolvers,
  pdfRenderErrorMessage,
  resolvePdfJsModule,
  resolvePdfWorkerSrc,
} = await import("./pdfjs-module.ts");

{
  const getDocument = () => ({ promise: Promise.resolve() });
  const GlobalWorkerOptions = { workerSrc: "" };
  const named = { GlobalWorkerOptions, getDocument };
  assert.equal(resolvePdfJsModule(named), named);
  assert.equal(resolvePdfJsModule({ default: named }), named);
}

assert.throws(
  () => resolvePdfJsModule(undefined),
  /Could not load the PDF viewer/,
);
assert.throws(
  () => resolvePdfJsModule({ default: undefined }),
  /Could not load the PDF viewer/,
);
assert.throws(
  () => resolvePdfJsModule({ GlobalWorkerOptions: { workerSrc: "" } }),
  /Could not load the PDF viewer/,
);

assert.equal(resolvePdfWorkerSrc("/assets/pdf.worker.min.mjs"), "/assets/pdf.worker.min.mjs");
assert.equal(
  resolvePdfWorkerSrc({ default: "/assets/pdf.worker.min.mjs" }),
  "/assets/pdf.worker.min.mjs",
);
assert.throws(() => resolvePdfWorkerSrc(undefined), /Could not load the PDF worker/);
assert.throws(() => resolvePdfWorkerSrc({ default: 1 }), /Could not load the PDF worker/);

{
  const fakePromise = function PromiseMock(executor) {
    let resolve;
    let reject;
    executor(
      (value) => {
        resolve = value;
      },
      (reason) => {
        reject = reason;
      },
    );
    return { resolve, reject };
  };
  ensurePromiseWithResolvers(fakePromise);
  const result = fakePromise.withResolvers();
  assert.equal(typeof result.promise, "object");
  assert.equal(typeof result.resolve, "function");
  assert.equal(typeof result.reject, "function");
}

{
  const calls = { count: 0 };
  const existing = function PromiseMock() {};
  existing.withResolvers = () => {
    calls.count += 1;
    return { promise: null, resolve() {}, reject() {} };
  };
  ensurePromiseWithResolvers(existing);
  existing.withResolvers();
  assert.equal(calls.count, 1);
}

assert.equal(pdfRenderErrorMessage(null), "Could not render PDF.");
assert.equal(
  pdfRenderErrorMessage(
    new Error("Cannot read properties of undefined (reading 'GlobalWorkerOptions')"),
  ),
  "Could not render PDF on this device. Use Download to open it.",
);
assert.equal(
  pdfRenderErrorMessage(new Error("Setting up fake worker failed: \"boom\".")),
  "Could not render PDF on this device. Use Download to open it.",
);
assert.equal(
  pdfRenderErrorMessage(new Error("Could not load the PDF.")),
  "Could not load the PDF.",
);

console.log("pdfjs-module tests passed");
