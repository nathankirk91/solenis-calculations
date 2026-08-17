import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import {
  parseSignatureImageDataUrl,
  signatureDisplayText,
  type RecordDocument,
  type RecordDocumentBlock,
  type RecordDocumentSignature,
} from "~/lib/record-document";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const NAVY = rgb(7 / 255, 38 / 255, 53 / 255);
const TEAL = rgb(0, 204 / 255, 153 / 255);
const MUTED = rgb(0.38, 0.42, 0.45);
const RULE = rgb(0.82, 0.85, 0.87);
const FLAGGED = rgb(0.55, 0.31, 0.04);
const WHITE = rgb(1, 1, 1);
const BODY = rgb(0.08, 0.12, 0.16);

const HEADER_HEIGHT = 36;
const SIGNATURE_MAX_WIDTH = 200;
const SIGNATURE_MAX_HEIGHT = 56;

function toWinAnsi(value: string): string {
  return value
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\u0000-\u00ff]/g, "?");
}

function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const sanitized = toWinAnsi(text).replace(/\r\n/g, "\n");
  const paragraphs = sanitized.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
      }
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const char of word) {
        const next = chunk + char;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          chunk = next;
        } else {
          if (chunk) {
            lines.push(chunk);
          }
          chunk = char;
        }
      }
      current = chunk;
    }
    if (current) {
      lines.push(current);
    }
  }

  return lines.length > 0 ? lines : [""];
}

class PdfLayout {
  private readonly pdf: PDFDocument;
  private readonly regular: PDFFont;
  private readonly bold: PDFFont;
  private page: PDFPage;
  private y: number;
  private pageNumber = 1;
  private readonly document: RecordDocument;

  constructor(
    pdf: PDFDocument,
    fonts: { regular: PDFFont; bold: PDFFont },
    document: RecordDocument,
  ) {
    this.pdf = pdf;
    this.regular = fonts.regular;
    this.bold = fonts.bold;
    this.document = document;
    this.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
    this.drawChrome();
  }

  async render(): Promise<void> {
    this.drawTitleBlock();
    this.drawMeta();
    for (const block of this.document.blocks) {
      await this.drawBlock(block);
    }
    this.finishPage();
  }

  private drawChrome(): void {
    this.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - HEADER_HEIGHT,
      width: PAGE_WIDTH,
      height: HEADER_HEIGHT,
      color: NAVY,
    });
    this.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - HEADER_HEIGHT - 3,
      width: PAGE_WIDTH,
      height: 3,
      color: TEAL,
    });
    this.page.drawText(toWinAnsi(this.document.siteName.toUpperCase()), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 23,
      size: 10,
      font: this.bold,
      color: WHITE,
    });
    const kindLabel =
      this.document.kind === "permit" ? "WORK PERMIT" : "INSPECTION RECORD";
    const kindWidth = this.bold.widthOfTextAtSize(kindLabel, 9);
    this.page.drawText(kindLabel, {
      x: PAGE_WIDTH - MARGIN_X - kindWidth,
      y: PAGE_HEIGHT - 23,
      size: 9,
      font: this.bold,
      color: WHITE,
    });
    this.y = PAGE_HEIGHT - HEADER_HEIGHT - 28;
  }

  private finishPage(): void {
    const footer = [
      this.document.footerNote,
      this.document.generatedAtLabel
        ? `Generated ${this.document.generatedAtLabel}`
        : null,
      `Page ${this.pageNumber}`,
    ]
      .filter(Boolean)
      .join("  |  ");
    this.page.drawLine({
      start: { x: MARGIN_X, y: MARGIN_BOTTOM - 8 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: MARGIN_BOTTOM - 8 },
      thickness: 0.6,
      color: RULE,
    });
    this.page.drawText(toWinAnsi(footer), {
      x: MARGIN_X,
      y: 22,
      size: 8,
      font: this.regular,
      color: MUTED,
    });
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed >= MARGIN_BOTTOM) {
      return;
    }
    this.finishPage();
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pageNumber += 1;
    this.drawChrome();
  }

  private drawTitleBlock(): void {
    const titleSize = 18;
    const titleLines = wrapText(
      this.bold,
      this.document.title,
      titleSize,
      CONTENT_WIDTH,
    );
    this.ensureSpace(titleLines.length * 22 + 36);
    for (const line of titleLines) {
      this.page.drawText(line, {
        x: MARGIN_X,
        y: this.y,
        size: titleSize,
        font: this.bold,
        color: NAVY,
      });
      this.y -= 22;
    }
    if (this.document.subtitle) {
      this.page.drawText(toWinAnsi(this.document.subtitle), {
        x: MARGIN_X,
        y: this.y,
        size: 12,
        font: this.bold,
        color: NAVY,
      });
      this.y -= 16;
    }
    this.page.drawText(toWinAnsi(`Status: ${this.document.status}`), {
      x: MARGIN_X,
      y: this.y,
      size: 10,
      font: this.bold,
      color: this.document.status.toLowerCase().includes("attention")
        ? FLAGGED
        : NAVY,
    });
    this.y -= 18;
  }

  private drawMeta(): void {
    this.ensureSpace(28);
    this.drawSectionHeading("Record details");
    const columnWidth = (CONTENT_WIDTH - 16) / 2;
    const rows: Array<[typeof this.document.meta[number], typeof this.document.meta[number] | null]> =
      [];
    for (let i = 0; i < this.document.meta.length; i += 2) {
      rows.push([this.document.meta[i], this.document.meta[i + 1] ?? null]);
    }
    for (const [left, right] of rows) {
      const leftLines = this.metaLines(left, columnWidth);
      const rightLines = right ? this.metaLines(right, columnWidth) : [];
      const height = Math.max(leftLines.length, rightLines.length) * 12 + 6;
      this.ensureSpace(height);
      this.drawMetaColumn(leftLines, MARGIN_X);
      if (right) {
        this.drawMetaColumn(rightLines, MARGIN_X + columnWidth + 16);
      }
      this.y -= height;
    }
    this.y -= 6;
  }

  private metaLines(
    item: { label: string; value: string },
    width: number,
  ): Array<{ text: string; bold: boolean; color: RGB }> {
    const valueLines = wrapText(this.regular, item.value, 10, width);
    return [
      { text: toWinAnsi(item.label.toUpperCase()), bold: true, color: MUTED },
      ...valueLines.map((text) => ({
        text,
        bold: false,
        color: BODY,
      })),
    ];
  }

  private drawMetaColumn(
    lines: Array<{ text: string; bold: boolean; color: RGB }>,
    x: number,
  ): void {
    let y = this.y;
    for (const line of lines) {
      this.page.drawText(line.text, {
        x,
        y,
        size: line.bold ? 8 : 10,
        font: line.bold ? this.bold : this.regular,
        color: line.color,
      });
      y -= 12;
    }
  }

  private drawSectionHeading(title: string): void {
    this.ensureSpace(28);
    this.page.drawText(toWinAnsi(title), {
      x: MARGIN_X,
      y: this.y,
      size: 12,
      font: this.bold,
      color: NAVY,
    });
    this.y -= 8;
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN_X, y: this.y },
      thickness: 1,
      color: TEAL,
    });
    this.y -= 14;
  }

  private async drawBlock(block: RecordDocumentBlock): Promise<void> {
    if (block.kind === "fields") {
      this.drawSectionHeading(block.title);
      for (const field of block.fields) {
        this.drawField(field.label, field.value, field.flagged);
      }
      this.y -= 6;
      return;
    }
    if (block.kind === "text") {
      this.drawSectionHeading(block.title);
      const lines = wrapText(this.regular, block.body, 10, CONTENT_WIDTH);
      for (const line of lines) {
        this.ensureSpace(14);
        this.page.drawText(line, {
          x: MARGIN_X,
          y: this.y,
          size: 10,
          font: this.regular,
          color: BODY,
        });
        this.y -= 14;
      }
      this.y -= 6;
      return;
    }
    if (block.kind === "list") {
      this.drawSectionHeading(block.title);
      for (const item of block.items) {
        const lines = wrapText(
          this.regular,
          item,
          10,
          CONTENT_WIDTH - 14,
        );
        this.ensureSpace(lines.length * 14 + 4);
        this.page.drawText("-", {
          x: MARGIN_X,
          y: this.y,
          size: 10,
          font: this.regular,
          color: NAVY,
        });
        for (const [index, line] of lines.entries()) {
          this.page.drawText(line, {
            x: MARGIN_X + 12,
            y: this.y,
            size: 10,
            font: this.regular,
            color: BODY,
          });
          this.y -= 14;
          if (index < lines.length - 1) {
            this.ensureSpace(14);
          }
        }
        this.y -= 2;
      }
      this.y -= 6;
      return;
    }

    this.drawSectionHeading(block.title);
    if (block.description) {
      const lines = wrapText(this.regular, block.description, 9, CONTENT_WIDTH);
      for (const line of lines) {
        this.ensureSpace(12);
        this.page.drawText(line, {
          x: MARGIN_X,
          y: this.y,
          size: 9,
          font: this.regular,
          color: MUTED,
        });
        this.y -= 12;
      }
      this.y -= 6;
    }
    for (const signature of block.signatures) {
      await this.drawSignature(signature);
    }
    this.y -= 6;
  }

  private drawField(label: string, value: string, flagged?: boolean): void {
    const labelWidth = CONTENT_WIDTH * 0.58;
    const valueWidth = CONTENT_WIDTH * 0.4;
    const labelLines = wrapText(this.regular, label, 9, labelWidth);
    const valueLines = wrapText(this.bold, value, 10, valueWidth);
    const height = Math.max(labelLines.length, valueLines.length) * 12 + 8;
    this.ensureSpace(height);
    const top = this.y;
    for (const [index, line] of labelLines.entries()) {
      this.page.drawText(line, {
        x: MARGIN_X,
        y: top - index * 12,
        size: 9,
        font: this.regular,
        color: MUTED,
      });
    }
    const valueColor = flagged ? FLAGGED : BODY;
    const valueX = MARGIN_X + CONTENT_WIDTH - valueWidth;
    for (const [index, line] of valueLines.entries()) {
      this.page.drawText(line, {
        x: valueX,
        y: top - index * 12,
        size: 10,
        font: this.bold,
        color: valueColor,
      });
    }
    this.y -= height - 2;
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y + 4 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: this.y + 4 },
      thickness: 0.4,
      color: RULE,
    });
  }

  private async drawSignature(
    signature: RecordDocumentSignature,
  ): Promise<void> {
    const parsed = parseSignatureImageDataUrl(signature.imageDataUrl);
    let image: PDFImage | null = null;
    if (parsed) {
      try {
        image =
          parsed.mime === "png"
            ? await this.pdf.embedPng(parsed.bytes)
            : await this.pdf.embedJpg(parsed.bytes);
      } catch {
        image = null;
      }
    }

    const textFallback = signatureDisplayText(signature.imageDataUrl);
    const captionLines = signature.caption
      ? wrapText(this.regular, signature.caption, 8, CONTENT_WIDTH - 16)
      : [];
    const nameLines = signature.name
      ? wrapText(this.regular, signature.name, 10, CONTENT_WIDTH - 16)
      : [];
    const boxHeight = image ? SIGNATURE_MAX_HEIGHT + 12 : textFallback ? 36 : 28;
    const height =
      18 + nameLines.length * 12 + captionLines.length * 11 + boxHeight + 16;
    this.ensureSpace(height);

    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - height + 10,
      width: CONTENT_WIDTH,
      height: height - 4,
      borderColor: RULE,
      borderWidth: 0.8,
      color: WHITE,
    });

    this.page.drawText(toWinAnsi(signature.label), {
      x: MARGIN_X + 10,
      y: this.y - 8,
      size: 9,
      font: this.bold,
      color: NAVY,
    });
    this.y -= 22;

    for (const line of nameLines) {
      this.page.drawText(line, {
        x: MARGIN_X + 10,
        y: this.y,
        size: 10,
        font: this.regular,
        color: BODY,
      });
      this.y -= 12;
    }
    for (const line of captionLines) {
      this.page.drawText(line, {
        x: MARGIN_X + 10,
        y: this.y,
        size: 8,
        font: this.regular,
        color: MUTED,
      });
      this.y -= 11;
    }

    if (image) {
      const scaled = image.scaleToFit(SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);
      this.page.drawRectangle({
        x: MARGIN_X + 10,
        y: this.y - scaled.height - 6,
        width: scaled.width + 8,
        height: scaled.height + 8,
        color: WHITE,
        borderColor: RULE,
        borderWidth: 0.5,
      });
      this.page.drawImage(image, {
        x: MARGIN_X + 14,
        y: this.y - scaled.height - 2,
        width: scaled.width,
        height: scaled.height,
      });
      this.y -= scaled.height + 18;
    } else if (textFallback) {
      this.page.drawText(toWinAnsi(textFallback), {
        x: MARGIN_X + 10,
        y: this.y - 4,
        size: 16,
        font: this.bold,
        color: NAVY,
      });
      this.y -= 28;
    } else if (signature.unsigned) {
      this.page.drawText("Not signed", {
        x: MARGIN_X + 10,
        y: this.y - 4,
        size: 10,
        font: this.regular,
        color: MUTED,
      });
      this.y -= 22;
    } else {
      this.page.drawText("Signature on file (image could not be rendered)", {
        x: MARGIN_X + 10,
        y: this.y - 4,
        size: 9,
        font: this.regular,
        color: MUTED,
      });
      this.y -= 22;
    }

    this.y -= 10;
  }
}

export async function renderRecordPdf(
  document: RecordDocument,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(document.title);
  pdf.setAuthor(document.siteName);
  pdf.setSubject(
    document.subtitle
      ? `${document.kind} ${document.subtitle}`
      : document.kind,
  );
  pdf.setCreator(document.siteName);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const layout = new PdfLayout(pdf, { regular, bold }, document);
  await layout.render();
  return pdf.save({ useObjectStreams: false });
}
