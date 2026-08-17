function asciiFilename(filename: string): string {
  const base = filename.replace(/["\\]/g, "").replace(/[^\x20-\x7E]/g, "_");
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

export function pdfFileResponse(
  bytes: Uint8Array,
  filename: string,
  options: { inline?: boolean } = {},
): Response {
  const safeName = asciiFilename(filename);
  const disposition = options.inline
    ? `inline; filename="${safeName}"`
    : `attachment; filename="${safeName}"`;
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
