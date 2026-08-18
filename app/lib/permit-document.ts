import { formatMelbourneDateTime, melbourneDateYmd } from "~/lib/datetime";
import {
  formatLastAnswerDisplay,
  resolvePermitFieldRole,
  type InspectionAnswerRecord,
} from "~/lib/inspections";
import {
  formatPermitDurationLabel,
  isPermitAuthSlotSigned,
  PERMIT_AUTH_SLOT_KEYS,
  PERMIT_AUTH_SLOT_LABELS,
  permitDurationMinutes,
  type AuthorizedPerson,
  type PermitAuthorization,
  type PermitCloseout,
} from "~/lib/permit.schema";
import {
  buildRecordFilename,
  emptyFieldValue,
  groupAnswersForDocument,
  RECORD_SITE_NAME,
  type RecordDocument,
} from "~/lib/record-document";

export type PermitDocumentInput = {
  id: string;
  permitNumber: string | null;
  status: "PENDING_AUTHORIZATION" | "OPEN" | "CLOSED";
  inspectionTitle: string;
  requiredSignerCount: number;
  equipmentRef: string | null;
  answers: InspectionAnswerRecord[];
  authorizedPersonnel: AuthorizedPerson[];
  authorization: PermitAuthorization;
  closeout: PermitCloseout | null;
  createdAt: Date;
  closedAt: Date | null;
  submittedByName: string | null;
  closedByName: string | null;
};

export function permitStatusLabel(
  status: PermitDocumentInput["status"],
): string {
  if (status === "PENDING_AUTHORIZATION") {
    return "Pending authorization";
  }
  if (status === "OPEN") {
    return "Open";
  }
  return "Closed";
}

export function durationLabelFromAnswers(
  answers: InspectionAnswerRecord[],
): string | null {
  const start = answers.find(
    (row) =>
      resolvePermitFieldRole({
        id: row.questionId,
        label: row.label,
        permitFieldRole: row.permitFieldRole,
      }) === "start_time",
  )?.answer;
  const end = answers.find(
    (row) =>
      resolvePermitFieldRole({
        id: row.questionId,
        label: row.label,
        permitFieldRole: row.permitFieldRole,
      }) === "end_time",
  )?.answer;
  if (!start || !end) {
    return null;
  }
  const minutes = permitDurationMinutes(start, end);
  if (minutes == null) {
    return null;
  }
  return formatPermitDurationLabel(minutes);
}

export function buildPermitDocument(
  run: PermitDocumentInput,
  options: { generatedAt?: Date } = {},
): RecordDocument {
  const generatedAt = options.generatedAt ?? new Date();
  const status = permitStatusLabel(run.status);
  const duration = durationLabelFromAnswers(run.answers);
  const submittedAt = formatMelbourneDateTime(run.createdAt) ?? emptyFieldValue("");

  const blocks: RecordDocument["blocks"] = [];

  for (const group of groupAnswersForDocument(run.answers)) {
    blocks.push({
      kind: "fields",
      title: group.title,
      fields: group.fields,
    });
  }

  if (duration) {
    blocks.push({
      kind: "fields",
      title: "Calculated duration",
      fields: [
        {
          label: "Duration (from start to end, max 12 hours)",
          value: duration,
        },
      ],
    });
  }

  blocks.push({
    kind: "signatures",
    title: "Authorized personnel",
    description:
      "Technicians, contractors, and visitors authorised to perform the work. The first person must sign; additional signatures are optional.",
    signatures:
      run.authorizedPersonnel.length > 0
        ? run.authorizedPersonnel.map((person, index) => ({
            label:
              index === 0
                ? "Authorized person (required sign-off)"
                : "Authorized person",
            name: person.name,
            imageDataUrl: person.signature,
            unsigned: !person.signature?.trim(),
          }))
        : [
            {
              label: "Authorized personnel",
              unsigned: true,
            },
          ],
  });

  blocks.push({
    kind: "signatures",
    title: "Authorization",
    description: `Two different people must sign before the permit opens. This permit requires ${run.requiredSignerCount} distinct authorisation signature${
      run.requiredSignerCount === 1 ? "" : "s"
    }. The same person cannot sign more than one role.`,
    signatures: PERMIT_AUTH_SLOT_KEYS.map((key) => {
      const person = run.authorization[key];
      const signed = isPermitAuthSlotSigned(person);
      const siteInspected = person.siteVerifiedAt
        ? formatMelbourneDateTime(person.siteVerifiedAt)
        : null;
      return {
        label: PERMIT_AUTH_SLOT_LABELS[key],
        name: signed ? person.name : undefined,
        caption: signed && siteInspected ? `Site inspected ${siteInspected}` : undefined,
        imageDataUrl: signed ? person.signature : null,
        unsigned: !signed,
      };
    }),
  });

  if (run.authorization.fewerThanTwoSignersReason) {
    blocks.push({
      kind: "text",
      title: "Fewer than two separate signatures",
      body: run.authorization.fewerThanTwoSignersReason,
    });
  }

  if (run.closeout) {
    blocks.push({
      kind: "fields",
      title: "Permit close-out",
      fields: [
        {
          label: "Close-out date",
          value: emptyFieldValue(
            formatLastAnswerDisplay(run.closeout.date, "DATE") || run.closeout.date,
          ),
        },
        {
          label: "Close-out time",
          value: emptyFieldValue(run.closeout.time),
        },
        {
          label: "Closed",
          value: emptyFieldValue(
            [
              formatMelbourneDateTime(run.closedAt),
              run.closedByName?.trim(),
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        },
      ],
    });
    blocks.push({
      kind: "signatures",
      title: "Close-out initials",
      signatures: [
        {
          label: "Operators initials",
          imageDataUrl: run.closeout.operatorsInitials,
          unsigned: !run.closeout.operatorsInitials?.trim(),
        },
        {
          label: "Maintenance initials",
          imageDataUrl: run.closeout.maintenanceInitials,
          unsigned: !run.closeout.maintenanceInitials?.trim(),
        },
      ],
    });
  }

  return {
    kind: "permit",
    title: run.inspectionTitle,
    subtitle: run.permitNumber ? `#${run.permitNumber}` : undefined,
    status,
    siteName: RECORD_SITE_NAME,
    generatedAtLabel: formatMelbourneDateTime(generatedAt) ?? "",
    filename: buildRecordFilename([
      run.inspectionTitle,
      run.permitNumber,
      run.equipmentRef,
      melbourneDateYmd(run.createdAt),
    ]),
    meta: [
      { label: "Permit number", value: emptyFieldValue(run.permitNumber) },
      { label: "Status", value: status },
      { label: "Submitted", value: submittedAt },
      { label: "Submitted by", value: emptyFieldValue(run.submittedByName) },
      { label: "Equipment", value: emptyFieldValue(run.equipmentRef) },
      {
        label: "Duration",
        value: emptyFieldValue(duration),
      },
      {
        label: "Required signatures",
        value: String(run.requiredSignerCount),
      },
    ],
    blocks,
  };
}
