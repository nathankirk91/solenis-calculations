export const MIN_PDF_ZOOM = 1;
export const MAX_PDF_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;

export function clampPdfZoom(zoom: number): number {
  return Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, zoom));
}

export function zoomFromPinch(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number {
  if (startDistance <= 0) {
    return clampPdfZoom(startZoom);
  }
  return clampPdfZoom(startZoom * (currentDistance / startDistance));
}

/** Keep the content point under the cursor/fingers after a scale change. */
export function scrollAfterZoom(args: {
  scroll: number;
  cursor: number;
  oldZoom: number;
  newZoom: number;
}): number {
  if (args.oldZoom <= 0) {
    return args.scroll;
  }
  const content = (args.scroll + args.cursor) / args.oldZoom;
  return content * args.newZoom - args.cursor;
}

export function touchDistance(
  a: Pick<Touch, "clientX" | "clientY">,
  b: Pick<Touch, "clientX" | "clientY">,
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function touchCenter(
  a: Pick<Touch, "clientX" | "clientY">,
  b: Pick<Touch, "clientX" | "clientY">,
): { x: number; y: number } {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}
