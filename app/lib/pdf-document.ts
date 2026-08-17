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
const MARGIN_BOTTOM = 56;
const FOOTER_RESERVE = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const MIN_Y = MARGIN_BOTTOM + FOOTER_RESERVE;

const NAVY = rgb(7 / 255, 38 / 255, 53 / 255);
const TEAL = rgb(0, 204 / 255, 153 / 255);
const MUTED = rgb(0.38, 0.42, 0.45);
const FLAGGED = rgb(0.55, 0.31, 0.04);
const WHITE = rgb(1, 1, 1);
const BODY = rgb(0.08, 0.12, 0.16);

const HEADER_HEIGHT = 36;
const SIGNATURE_MAX_WIDTH = 180;
const SIGNATURE_MAX_HEIGHT = 52;
const ROW_GAP = 8;
const SECTION_GAP = 14;
const LINE_HEIGHT = 12;

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
  private footerDrawn = false;
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
    this.drawFooterIfNeeded();
  }

  private drawChrome(): void {
    this.footerDrawn = false;
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

  private drawFooterIfNeeded(): void {
    if (this.footerDrawn) {
      return;
    }
    const footer = [
      this.document.footerNote,
      this.document.generatedAtLabel
        ? `Generated ${this.document.generatedAtLabel}`
        : null,
      `Page ${this.pageNumber}`,
    ]
      .filter(Boolean)
      .join("  |  ");
    this.page.drawText(toWinAnsi(footer), {
      x: MARGIN_X,
      y: 24,
      size: 8,
      font: this.regular,
      color: MUTED,
    });
    this.footerDrawn = true;
  }

  private startNewPage(): void {
    this.drawFooterIfNeeded();
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pageNumber += 1;
    this.drawChrome();
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed >= MIN_Y) {
      return;
    }
    this.startNewPage();
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
    this.y -= 20;
  }

  private drawMeta(): void {
    this.ensureSpace(28);
    this.drawSectionHeading("Record details", { rule: false });
    const columnWidth = (CONTENT_WIDTH - 16) / 2;
    const rows: Array<
      [typeof this.document.meta[number], typeof this.document.meta[number] | null]
    > = [];
    for (let i = 0; i < this.document.meta.length; i += 2) {
      rows.push([this.document.meta[i], this.document.meta[i + 1] ?? null]);
    }
    for (const [left, right] of rows) {
      const leftLines = this.metaLines(left, columnWidth);
      const rightLines = right ? this.metaLines(right, columnWidth) : [];
      const height = Math.max(leftLines.length, rightLines.length) * LINE_HEIGHT + 4;
      this.ensureSpace(height);
      this.drawMetaColumn(leftLines, MARGIN_X);
      if (right) {
        this.drawMetaColumn(rightLines, MARGIN_X + columnWidth + 16);
      }
      this.y -= height;
    }
    this.y -= SECTION_GAP;
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
      y -= LINE_HEIGHT;
    }
  }

  private drawSectionHeading(
    title: string,
    options: { rule?: boolean; continued?: boolean } = {},
  ): void {
    const label = options.continued ? `${title} (continued)` : title;
    this.ensureSpace(24);
    this.y -= 4;
    this.page.drawText(toWinAnsi(label), {
      x: MARGIN_X,
      y: this.y,
      size: 12,
      font: this.bold,
      color: NAVY,
    });
    this.y -= 10;
    if (options.rule !== false) {
      this.page.drawLine({
        start: { x: MARGIN_X, y: this.y },
        end: { x: PAGE_WIDTH - MARGIN_X, y: this.y },
        thickness: 0.75,
        color: TEAL,
      });
      this.y -= 10;
    } else {
      this.y -= 4;
    }
  }

  private async drawBlock(
    block: RecordDocumentBlock,
    continued = false,
  ): Promise<void> {
    if (block.kind === "fields") {
      this.drawSectionHeading(block.title, { continued });
      for (const field of block.fields) {
        this.drawField(field.label, field.value, field.flagged);
      }
      this.y -= SECTION_GAP;
      return;
    }
    if (block.kind === "text") {
      this.drawSectionHeading(block.title, { continued });
      const lines = wrapText(this.regular, block.body, 10, CONTENT_WIDTH);
      for (const line of lines) {
        this.ensureSpace(LINE_HEIGHT + 2);
        this.page.drawText(line, {
          x: MARGIN_X,
          y: this.y,
          size: 10,
          font: this.regular,
          color: BODY,
        });
        this.y -= LINE_HEIGHT + 2;
      }
      this.y -= SECTION_GAP;
      return;
    }
    if (block.kind === "list") {
      this.drawSectionHeading(block.title, { continued });
      for (const item of block.items) {
        const lines = wrapText(this.regular, item, 10, CONTENT_WIDTH - 14);
        this.ensureSpace(lines.length * (LINE_HEIGHT + 2) + 2);
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
          this.y -= LINE_HEIGHT + 2;
          if (index < lines.length - 1) {
            this.ensureSpace(LINE_HEIGHT + 2);
          }
        }
      }
      this.y -= SECTION_GAP;
      return;
    }

    await this.drawSignatureBlock(block, continued);
  }

  private drawField(label: string, value: string, flagged?: boolean): void {
    const trimmedLabel = label.trim();
    const labelWidth = CONTENT_WIDTH * 0.62;
    const valueWidth = CONTENT_WIDTH * 0.34;
    const valueX = MARGIN_X + CONTENT_WIDTH - valueWidth;

    if (!trimmedLabel) {
      const valueLines = wrapText(this.bold, value, 10, CONTENT_WIDTH);
      const height = valueLines.length * LINE_HEIGHT + ROW_GAP;
      this.ensureSpace(height);
      for (const [index, line] of valueLines.entries()) {
        this.page.drawText(line, {
          x: MARGIN_X,
          y: this.y - index * LINE_HEIGHT,
          size: 10,
          font: this.bold,
          color: flagged ? FLAGGED : BODY,
        });
      }
      this.y -= height;
      return;
    }

    const labelLines = wrapText(this.regular, trimmedLabel, 9, labelWidth);
    const valueLines = wrapText(this.bold, value, 10, valueWidth);
    const rowLines = Math.max(labelLines.length, valueLines.length);
    const height = rowLines * LINE_HEIGHT + ROW_GAP;
    this.ensureSpace(height);
    const top = this.y;

    for (const [index, line] of labelLines.entries()) {
      this.page.drawText(line, {
        x: MARGIN_X,
        y: top - index * LINE_HEIGHT,
        size: 9,
        font: this.regular,
        color: MUTED,
      });
    }

    const valueColor = flagged ? FLAGGED : BODY;
    for (const [index, line] of valueLines.entries()) {
      this.page.drawText(line, {
        x: valueX,
        y: top - index * LINE_HEIGHT,
        size: 10,
        font: this.bold,
        color: valueColor,
      });
    }

    this.y -= height;
  }

  private async drawSignatureBlock(
    block: Extract<RecordDocumentBlock, { kind: "signatures" }>,
    continued: boolean,
  ): Promise<void> {
    const descriptionLines = block.description
      ? wrapText(this.regular, block.description, 9, CONTENT_WIDTH)
      : [];
    const headingSpace = 24 + descriptionLines.length * (LINE_HEIGHT + 1) + 6;

    let index = 0;
    if (!continued) {
      this.ensureSpace(headingSpace + this.estimateSignatureHeight(block.signatures[0]));
      this.drawSectionHeading(block.title);
      for (const line of descriptionLines) {
        this.page.drawText(line, {
          x: MARGIN_X,
          y: this.y,
          size: 9,
          font: this.regular,
          color: MUTED,
        });
        this.y -= LINE_HEIGHT + 1;
      }
      this.y -= 4;
    } else {
      this.drawSectionHeading(block.title, { continued: true });
    }

    while (index < block.signatures.length) {
      const signature = block.signatures[index];
      const height = this.estimateSignatureHeight(signature);
      if (this.y - height < MIN_Y) {
        this.startNewPage();
        this.drawSectionHeading(block.title, { continued: true });
      }
      await this.drawSignature(signature);
      index += 1;
    }

    this.y -= SECTION_GAP;
  }

  private estimateSignatureHeight(signature: RecordDocumentSignature): number {
    const parsed = parseSignatureImageDataUrl(signature.imageDataUrl);
    const textFallback = signatureDisplayText(signature.imageDataUrl);
    const captionLines = signature.caption
      ? wrapText(this.regular, signature.caption, 8, CONTENT_WIDTH - 20).length
      : 0;
    const nameLines = signature.name
      ? wrapText(this.regular, signature.name, 10, CONTENT_WIDTH - 20).length
      : 0;
    const bodyHeight = parsed
      ? SIGNATURE_MAX_HEIGHT + 12
      : textFallback
        ? 28
        : 18;
    return 16 + nameLines * LINE_HEIGHT + captionLines * 11 + bodyHeight + 12;
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
      ? wrapText(this.regular, signature.caption, 8, CONTENT_WIDTH - 20)
      : [];
    const nameLines = signature.name
      ? wrapText(this.regular, signature.name, 10, CONTENT_WIDTH - 20)
      : [];
    const imageHeight = image ? SIGNATURE_MAX_HEIGHT + 8 : 0;
    const bodyHeight = image
      ? imageHeight
      : textFallback
        ? 24
        : signature.unsigned
          ? 16
          : 16;
    const cardHeight =
      14 +
      nameLines.length * LINE_HEIGHT +
      captionLines.length * 11 +
      bodyHeight +
      10;

    this.page.drawText(toWinAnsi(signature.label), {
      x: MARGIN_X,
      y: this.y,
      size: 9,
      font: this.bold,
      color: NAVY,
    });
    this.y -= 14;

    for (const line of nameLines) {
      this.page.drawText(line, {
        x: MARGIN_X + 8,
        y: this.y,
        size: 10,
        font: this.regular,
        color: BODY,
      });
      this.y -= LINE_HEIGHT;
    }
    for (const line of captionLines) {
      this.page.drawText(line, {
        x: MARGIN_X + 8,
        y: this.y,
        size: 8,
        font: this.regular,
        color: MUTED,
      });
      this.y -= 11;
    }

    const contentTop = this.y;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: contentTop - bodyHeight,
      width: CONTENT_WIDTH,
      height: bodyHeight,
      borderColor: MUTED,
      borderWidth: 0.5,
      color: WHITE,
    });

    if (image) {
      const scaled = image.scaleToFit(SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);
      this.page.drawImage(image, {
        x: MARGIN_X + 8,
        y: contentTop - scaled.height - 4,
        width: scaled.width,
        height: scaled.height,
      });
    } else if (textFallback) {
      this.page.drawText(toWinAnsi(textFallback), {
        x: MARGIN_X + 8,
        y: contentTop - 18,
        size: 16,
        font: this.bold,
        color: NAVY,
      });
    } else if (signature.unsigned) {
      this.page.drawText("Not signed", {
        x: MARGIN_X + 8,
        y: contentTop - 16,
        size: 10,
        font: this.regular,
        color: MUTED,
      });
    } else {
      this.page.drawText("Signature on file", {
        x: MARGIN_X + 8,
        y: contentTop - 16,
        size: 9,
        font: this.regular,
        color: MUTED,
      });
    }

    this.y = contentTop - bodyHeight - 10;
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
