function asciiFilename(filename: string): string {
  const base = filename.replace(/["\\]/g, "").replace(/[^\x20-\x7E]/g, "_");
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

export function pdfFileResponse(
  bytes: Uint8Array,
  filename: string,
): Response {
  const safeName = asciiFilename(filename);
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
