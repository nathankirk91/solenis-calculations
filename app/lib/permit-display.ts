import type { InspectionAnswerRecord } from "~/lib/inspections";

type PermitRunStatus = "PENDING_AUTHORIZATION" | "OPEN" | "CLOSED";

export function workDescriptionFromAnswers(
  answers: InspectionAnswerRecord[],
): string | null {
  const row = answers.find(
    (answer) =>
      answer.questionId.endsWith("__work-to-be-performed") ||
      answer.label.trim().toLowerCase() === "work to be performed",
  );
  const value = row?.answer?.trim();
  return value || null;
}

export function permitRecordHeading(args: {
  workDescription: string | null;
  equipmentRef: string | null;
  permitNumber: string | null;
}): string {
  if (args.workDescription) {
    return args.workDescription;
  }
  if (args.equipmentRef?.trim()) {
    return args.equipmentRef.trim();
  }
  if (args.permitNumber?.trim()) {
    return `#${args.permitNumber.trim()}`;
  }
  return "Permit";
}

export function permitStatusLabel(status: PermitRunStatus): string {
  if (status === "PENDING_AUTHORIZATION") {
    return "Pending authorization";
  }
  if (status === "OPEN") {
    return "Open";
  }
  return "Closed";
}
