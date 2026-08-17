import type { Route } from "./+types/inspection-submission-pdf";

import { requireUser } from "~/lib/auth.server";
import { buildInspectionDocument } from "~/lib/inspection-document";
import { getInspectionRunById } from "~/lib/inspections.server";
import { renderRecordPdf } from "~/lib/pdf-document";
import { pdfFileResponse } from "~/lib/pdf-response.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, `/inspections/submissions/${params.runId}/pdf`);
  const run = await getInspectionRunById(params.runId);
  if (!run) {
    throw new Response("Inspection submission not found", { status: 404 });
  }

  const document = buildInspectionDocument(run);
  const bytes = await renderRecordPdf(document);
  return pdfFileResponse(bytes, document.filename);
}
