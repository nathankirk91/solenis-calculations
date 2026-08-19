import type { Route } from "./+types/inspection-submission-pdf-view";

import { pageTitle } from "~/lib/brand";
import { RecordPdfViewer } from "~/components/record-pdf-viewer";
import { requireUser } from "~/lib/auth.server";
import { buildInspectionDocument } from "~/lib/inspection-document";
import { getInspectionRunById } from "~/lib/inspections.server";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: pageTitle(`${loaderData?.title ?? "Inspection"} PDF`),
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(
    request,
    `/inspections/submissions/${params.runId}/pdf/view`,
  );
  const run = await getInspectionRunById(params.runId);
  if (!run) {
    throw new Response("Inspection submission not found", { status: 404 });
  }

  const document = buildInspectionDocument(run);
  const base = `/inspections/submissions/${run.id}/pdf`;

  return {
    title: run.inspectionTitle,
    filename: document.filename,
    pdfUrl: `${base}?inline=1`,
    downloadUrl: base,
    backUrl: `/inspections/submissions/${run.id}`,
  };
}

export default function InspectionSubmissionPdfViewPage({
  loaderData,
}: Route.ComponentProps) {
  return <RecordPdfViewer {...loaderData} />;
}
