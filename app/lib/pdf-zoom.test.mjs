import assert from "node:assert/strict";

const {
  DOUBLE_TAP_ZOOM,
  MAX_PDF_ZOOM,
  MIN_PDF_ZOOM,
  clampPdfZoom,
  scrollAfterZoom,
  touchCenter,
  touchDistance,
  zoomFromPinch,
} = await import("./pdf-zoom.ts");

assert.equal(clampPdfZoom(0.5), MIN_PDF_ZOOM);
assert.equal(clampPdfZoom(1), 1);
assert.equal(clampPdfZoom(2.5), DOUBLE_TAP_ZOOM);
assert.equal(clampPdfZoom(9), MAX_PDF_ZOOM);

assert.equal(zoomFromPinch(1, 100, 200), 2);
assert.equal(zoomFromPinch(2, 100, 50), 1);
assert.equal(zoomFromPinch(1, 100, 800), MAX_PDF_ZOOM);
assert.equal(zoomFromPinch(1, 0, 100), 1);

assert.equal(
  scrollAfterZoom({ scroll: 0, cursor: 100, oldZoom: 1, newZoom: 2 }),
  100,
);
assert.equal(
  scrollAfterZoom({ scroll: 50, cursor: 50, oldZoom: 1, newZoom: 2 }),
  150,
);

assert.equal(touchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }), 5);
assert.deepEqual(touchCenter({ clientX: 0, clientY: 2 }, { clientX: 4, clientY: 6 }), {
  x: 2,
  y: 4,
});

console.log("pdf-zoom tests passed");
