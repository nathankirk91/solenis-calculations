import type { Route } from "./+types/permit-run-pdf";

import { requireUser } from "~/lib/auth.server";
import { buildPermitDocument } from "~/lib/permit-document";
import { getPermitRunById } from "~/lib/permits.server";
import { renderRecordPdf } from "~/lib/pdf-document";
import { pdfFileResponse } from "~/lib/pdf-response.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, `/permits/runs/${params.permitRunId}/pdf`);
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }

  const document = buildPermitDocument(run);
  const bytes = await renderRecordPdf(document);
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return pdfFileResponse(bytes, document.filename, { inline });
}
