import assert from "node:assert/strict";
import zlib from "node:zlib";

/**
 * Integration: human-readable PDF documents for inspections and permits
 * include every field and signature image.
 */
const { SAFE_WORK_PERMIT, buildAnswersFromResponses } = await import(
  "../../app/lib/inspections.ts"
);
const { emptyPermitAuthorization } = await import(
  "../../app/lib/permit.schema.ts"
);
const { buildInspectionDocument } = await import(
  "../../app/lib/inspection-document.ts"
);
const { buildPermitDocument } = await import("../../app/lib/permit-document.ts");
const { renderRecordPdf } = await import("../../app/lib/pdf-document.ts");
const {
  buildRecordFilename,
  emptyFieldValue,
  groupAnswersForDocument,
  parseSignatureImageDataUrl,
  signatureDisplayText,
} = await import("../../app/lib/record-document.ts");

const SAMPLE_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function decodePdfHexStrings(text) {
  return text.replace(/<([0-9A-Fa-f]+)>/g, (_, hex) => {
    const buf = Buffer.from(hex, "hex");
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      let out = "";
      for (let i = 2; i + 1 < buf.length; i += 2) {
        out += String.fromCharCode((buf[i] << 8) | buf[i + 1]);
      }
      return out;
    }
    return buf.toString("latin1");
  });
}

function pdfReadableText(bytes) {
  const raw = Buffer.from(bytes);
  const latin1 = raw.toString("latin1");
  const parts = [latin1];
  for (const match of latin1.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      parts.push(
        zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"),
      );
    } catch {
      // Image streams and already-plain content can fail inflate.
    }
  }
  return decodePdfHexStrings(parts.join("\n"));
}

assert.equal(emptyFieldValue(""), "—");
assert.equal(emptyFieldValue("  Yes  "), "Yes");
assert.equal(
  buildRecordFilename(["Safe Work Permit", "2608002", "2026-08-17"]),
  "Safe-Work-Permit-2608002-2026-08-17.pdf",
);
assert.equal(buildRecordFilename(["", null]), "record.pdf");

{
  const parsed = parseSignatureImageDataUrl(SAMPLE_SIGNATURE);
  assert.ok(parsed);
  assert.equal(parsed.mime, "png");
  assert.ok(parsed.bytes.length > 0);
  assert.equal(signatureDisplayText(SAMPLE_SIGNATURE), null);
  assert.equal(signatureDisplayText("JD"), "JD");
  assert.equal(signatureDisplayText(""), null);
  assert.equal(parseSignatureImageDataUrl("JD"), null);
}

{
  const answers = [
    {
      questionId: "a",
      label: "Date",
      sectionTitle: "Permit details",
      type: "DATE",
      answer: "2026-08-17",
      flagged: false,
    },
    {
      questionId: "b",
      label: "Area",
      sectionTitle: "Permit details",
      type: "TEXT",
      answer: "",
      flagged: false,
    },
    {
      questionId: "c__permit-duration",
      label: "Duration",
      sectionTitle: "Permit details",
      type: "TEXT",
      answer: "8 hours",
      flagged: false,
    },
    {
      questionId: "d",
      label: "Work",
      sectionTitle: "Work details",
      type: "TEXT",
      answer: "Repair pump",
      flagged: false,
    },
  ];
  const groups = groupAnswersForDocument(answers);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].title, "Permit details");
  assert.equal(groups[0].fields.length, 2);
  assert.equal(groups[0].fields[0].value, "17 Aug 2026");
  assert.equal(groups[0].fields[1].value, "—");
  assert.equal(groups[1].fields[0].label, "Work");
}

{
  const generatedAt = new Date("2026-08-17T01:00:00.000Z");
  const doc = buildInspectionDocument(
    {
      id: "run-1",
      inspectionTitle: "Forklift H57168 — Daily Safety Check",
      status: "NEEDS_ATTENTION",
      operatorName: "Alex Operator",
      equipmentRef: "H57168",
      createdAt: generatedAt,
      notes: "Horn is weak.",
      signature: SAMPLE_SIGNATURE,
      summary: {
        answeredCount: 2,
        attentionCount: 1,
        attentionItems: [
          {
            itemId: "horn",
            label: "Horn / reverse alarm",
            sectionTitle: "After start",
            answer: "No",
          },
        ],
      },
      answers: [
        {
          questionId: "shift",
          label: "Shift",
          sectionTitle: "Shift details",
          type: "RADIO",
          answer: "Day",
          flagged: false,
        },
        {
          questionId: "horn",
          label: "Horn / reverse alarm",
          sectionTitle: "After start",
          type: "YES_NO",
          answer: "No",
          flagged: true,
        },
        {
          questionId: "optional",
          label: "Reported immediately to",
          sectionTitle: "Tagged out",
          type: "TEXT",
          answer: "",
          flagged: false,
        },
      ],
      actions: [
        {
          id: "act-1",
          description: "Replace reverse alarm.",
          status: "OPEN",
          createdAt: generatedAt,
          createdByOperatorName: "Alex Operator",
          closedAt: null,
          closedByName: null,
          completionComment: null,
        },
      ],
    },
    { generatedAt },
  );

  assert.equal(doc.kind, "inspection");
  assert.equal(doc.status, "Needs attention");
  assert.match(doc.filename, /Forklift-H57168/);
  assert.equal(doc.filename.endsWith(".pdf"), true);

  const labels = doc.blocks.flatMap((block) => {
    if (block.kind === "fields") {
      return block.fields.map((field) => field.label);
    }
    return [];
  });
  assert.deepEqual(labels, [
    "Shift",
    "Horn / reverse alarm",
    "Reported immediately to",
  ]);
  const empty = doc.blocks
    .filter((block) => block.kind === "fields")
    .flatMap((block) => block.fields)
    .find((field) => field.label === "Reported immediately to");
  assert.equal(empty?.value, "—");

  const followUp = doc.blocks.find((block) => block.kind === "list");
  assert.equal(followUp?.title, "Follow-up items");
  assert.match(followUp.items[0], /Horn \/ reverse alarm/);

  const notes = doc.blocks.find(
    (block) => block.kind === "text" && block.title === "Notes",
  );
  assert.equal(notes?.body, "Horn is weak.");

  const signatureBlock = doc.blocks.find(
    (block) => block.kind === "signatures",
  );
  assert.equal(signatureBlock?.signatures[0].imageDataUrl, SAMPLE_SIGNATURE);
  assert.equal(signatureBlock?.signatures[0].unsigned, false);

  const bytes = await renderRecordPdf(doc);
  const text = pdfReadableText(bytes);
  assert.equal(Buffer.from(bytes).toString("latin1").startsWith("%PDF"), true);
  assert.match(text, /Daily Safety Check/);
  assert.match(text, /Horn \/ reverse alarm/);
  assert.match(text, /Alex Operator/);
  assert.match(text, /\/Subtype\s*\/Image/);
}

{
  const responses = {};
  for (const question of SAFE_WORK_PERMIT.questions) {
    if (question.type === "YES_NO") {
      responses[question.id] = "Yes";
    } else if (question.type === "RADIO") {
      responses[question.id] = question.options[0];
    } else if (question.type === "CHECKBOX") {
      responses[question.id] = question.options.slice(0, 2).join("|");
    } else if (question.type === "NUMBER") {
      responses[question.id] = "1";
    } else if (question.type === "DATE") {
      responses[question.id] = "2026-08-17";
    } else if (question.type === "TIME") {
      responses[question.id] =
        question.permitFieldRole === "end_time" ? "16:00" : "08:00";
    } else if (question.required) {
      responses[question.id] = "Polymer plant";
    } else {
      responses[question.id] = "";
    }
  }
  responses["safe-work-permit__work-to-be-performed"] = "Replace gasket";
  responses["safe-work-permit__area"] = "Tank farm";

  const answers = buildAnswersFromResponses(SAFE_WORK_PERMIT, responses);
  const authorization = emptyPermitAuthorization();
  authorization.operationsRep = {
    userId: "u1",
    name: "Pat Manager",
    signature: SAMPLE_SIGNATURE,
    siteVerifiedAt: "2026-08-17T01:00:00.000Z",
  };

  const doc = buildPermitDocument(
    {
      id: "permit-1",
      permitNumber: "2608002",
      status: "CLOSED",
      inspectionTitle: SAFE_WORK_PERMIT.title,
      requiredSignerCount: 2,
      equipmentRef: "P-12",
      answers,
      authorizedPersonnel: [
        { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
        { name: "Sam Helper", signature: "" },
      ],
      authorization,
      closeout: {
        date: "2026-08-17",
        time: "15:30",
        operatorsInitials: SAMPLE_SIGNATURE,
        maintenanceInitials: "JD",
      },
      createdAt: new Date("2026-08-17T01:00:00.000Z"),
      closedAt: new Date("2026-08-17T05:30:00.000Z"),
      submittedByName: "Alex Operator",
      closedByName: "Pat Manager",
    },
    { generatedAt: new Date("2026-08-17T06:00:00.000Z") },
  );

  assert.equal(doc.kind, "permit");
  assert.equal(doc.subtitle, "#2608002");
  assert.equal(doc.status, "Closed");

  const fieldLabels = doc.blocks
    .filter((block) => block.kind === "fields")
    .flatMap((block) => block.fields.map((field) => field.label));
  for (const question of SAFE_WORK_PERMIT.questions) {
    assert.ok(
      fieldLabels.includes(question.label),
      `missing field: ${question.label}`,
    );
  }
  assert.ok(fieldLabels.includes("Duration (from start to end, max 12 hours)"));
  assert.ok(fieldLabels.includes("Close-out date"));
  assert.ok(fieldLabels.includes("Close-out time"));

  const optionalEmpty = doc.blocks
    .filter((block) => block.kind === "fields")
    .flatMap((block) => block.fields)
    .find((field) => field.label === "Other PPE (specify)");
  assert.equal(optionalEmpty?.value, "—");

  const ppe = doc.blocks
    .filter((block) => block.kind === "fields")
    .flatMap((block) => block.fields)
    .find((field) => field.label.startsWith("Required PPE"));
  assert.match(ppe?.value ?? "", /Face shield/);
  assert.match(ppe?.value ?? "", /Leather gloves/);

  const signatureTitles = doc.blocks
    .filter((block) => block.kind === "signatures")
    .map((block) => block.title);
  assert.deepEqual(signatureTitles, [
    "Authorized personnel",
    "Authorization",
    "Close-out initials",
  ]);

  const personnel = doc.blocks.find(
    (block) =>
      block.kind === "signatures" && block.title === "Authorized personnel",
  );
  assert.equal(personnel.signatures.length, 2);
  assert.equal(personnel.signatures[0].imageDataUrl, SAMPLE_SIGNATURE);
  assert.equal(personnel.signatures[1].unsigned, true);

  const auth = doc.blocks.find(
    (block) => block.kind === "signatures" && block.title === "Authorization",
  );
  assert.equal(auth.signatures.length, 3);
  assert.equal(auth.signatures[0].unsigned, false);
  assert.equal(auth.signatures[1].unsigned, true);
  assert.equal(auth.signatures[2].unsigned, true);
  assert.match(auth.signatures[0].caption ?? "", /Site inspected/);

  const closeout = doc.blocks.find(
    (block) =>
      block.kind === "signatures" && block.title === "Close-out initials",
  );
  assert.equal(closeout.signatures[0].imageDataUrl, SAMPLE_SIGNATURE);
  assert.equal(closeout.signatures[1].imageDataUrl, "JD");
  assert.equal(closeout.signatures[1].unsigned, false);

  const bytes = await renderRecordPdf(doc);
  const text = pdfReadableText(bytes);
  assert.equal(Buffer.from(bytes).toString("latin1").startsWith("%PDF"), true);
  assert.match(text, /Safe Work Permit/);
  assert.match(text, /2608002/);
  assert.match(text, /Work to be performed/);
  assert.match(text, /Authorized personnel/);
  assert.match(text, /Operations representative/);
  assert.match(text, /Safe work coordinator/);
  assert.match(text, /Not signed/);
  assert.match(text, /Operators initials/);
  assert.match(text, /Maintenance initials/);
  assert.match(text, /\/Subtype\s*\/Image/);

  for (const question of SAFE_WORK_PERMIT.questions) {
    const snippet = question.label.slice(0, 24);
    assert.match(
      text,
      new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `PDF missing field text: ${question.label}`,
    );
  }
}

console.log("record-pdf integration tests passed");
