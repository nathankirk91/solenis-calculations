import { data } from "react-router";

import type { Route } from "./+types/inspection-open-actions";

import { requireUser } from "~/lib/auth.server";
import {
  getInspectionDefinition,
  listOpenInspectionActions,
  type InspectionActionItem,
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
    return data({ actions: [] as InspectionActionItem[] });
  }

  const actions = await listOpenInspectionActions({
    inspectionId: definition.id,
    equipmentRef,
  });

  return data({ actions });
}
