import { data } from "react-router";

import type { Route } from "./+types/inspection-last-answers";

import { requireUser } from "~/lib/auth.server";
import {
  getInspectionDefinition,
  getLastAnswersForInspection,
} from "~/lib/inspections.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }

  await requireUser(request, definition.href);

  const url = new URL(request.url);
  const equipmentRef =
    url.searchParams.get("equipmentRef") ||
    definition.fixedEquipmentRef ||
    null;

  const needsEquipmentPick =
    Boolean(definition.equipmentLabel) && !definition.fixedEquipmentRef;

  if (needsEquipmentPick && !equipmentRef?.trim()) {
    return data({
      answers: {} as Record<string, string>,
      runId: null as string | null,
      createdAt: null as string | null,
    });
  }

  const result = await getLastAnswersForInspection({
    inspectionId: definition.id,
    equipmentRef,
  });

  return data(result);
}
