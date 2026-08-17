import type { Route } from "./+types/permit-run-pdf-view";

import { RecordPdfViewer } from "~/components/record-pdf-viewer";
import { requireUser } from "~/lib/auth.server";
import { buildPermitDocument } from "~/lib/permit-document";
import { getPermitRunById } from "~/lib/permits.server";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `${loaderData?.title ?? "Permit"} PDF | Springvale Solenis` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request, `/permits/runs/${params.permitRunId}/pdf/view`);
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }

  const document = buildPermitDocument(run);
  const base = `/permits/runs/${run.id}/pdf`;

  return {
    title: run.inspectionTitle,
    filename: document.filename,
    pdfUrl: `${base}?inline=1`,
    downloadUrl: base,
    backUrl: `/permits/runs/${run.id}`,
  };
}

export default function PermitRunPdfViewPage({
  loaderData,
}: Route.ComponentProps) {
  return <RecordPdfViewer {...loaderData} />;
}
