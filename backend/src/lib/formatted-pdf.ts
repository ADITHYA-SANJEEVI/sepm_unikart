import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type PdfTone = "brand" | "neutral" | "success" | "warning" | "danger";

export interface PdfKeyValue {
  label: string;
  value: string;
}

export interface PdfSection {
  title: string;
  summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  facts?: PdfKeyValue[];
  tone?: PdfTone;
}

export interface UniKartPdfSpec {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  meta?: PdfKeyValue[];
  sections: PdfSection[];
  footerNote?: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 42;
const MARGIN_BOTTOM = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const SECTION_GAP = 14;

const COLORS = {
  page: rgb(0.972, 0.98, 0.988),
  surface: rgb(1, 1, 1),
  surfaceSoft: rgb(0.961, 0.969, 0.984),
  border: rgb(0.886, 0.91, 0.941),
  borderStrong: rgb(0.796, 0.835, 0.894),
  text: rgb(0.059, 0.09, 0.165),
  secondary: rgb(0.2, 0.27, 0.36),
  muted: rgb(0.392, 0.471, 0.545),
  brand: rgb(0.384, 0.357, 1),
  brandDeep: rgb(0.278, 0.247, 0.918),
  brandSoft: rgb(0.937, 0.929, 1),
  success: rgb(0.086, 0.639, 0.29),
  successSoft: rgb(0.894, 0.984, 0.925),
  warning: rgb(0.824, 0.549, 0.035),
  warningSoft: rgb(0.996, 0.953, 0.78),
  danger: rgb(0.82, 0.149, 0.149),
  dangerSoft: rgb(0.996, 0.886, 0.886),
};

interface LayoutState {
  page: PDFPage;
  y: number;
}

interface TonePalette {
  fill: ReturnType<typeof rgb>;
  panel: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
}

function sanitize(text: string) {
  return String(text ?? "")
    .replace(/\u20B9/g, "INR ")
    .replace(/[•·]/g, "- ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tonePalette(tone: PdfTone | undefined): TonePalette {
  switch (tone) {
    case "brand":
      return { fill: COLORS.brandSoft, panel: COLORS.surface, accent: COLORS.brand };
    case "success":
      return { fill: COLORS.successSoft, panel: COLORS.surface, accent: COLORS.success };
    case "warning":
      return { fill: COLORS.warningSoft, panel: COLORS.surface, accent: COLORS.warning };
    case "danger":
      return { fill: COLORS.dangerSoft, panel: COLORS.surface, accent: COLORS.danger };
    default:
      return { fill: COLORS.surfaceSoft, panel: COLORS.surface, accent: COLORS.borderStrong };
  }
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const paragraphs = sanitize(text).split(/\n+/).filter(Boolean);
  if (!paragraphs.length) return [""];

  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ").filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = word;
        continue;
      }

      let remainder = word;
      while (remainder.length) {
        let sliceLength = remainder.length;
        while (sliceLength > 1 && font.widthOfTextAtSize(remainder.slice(0, sliceLength), fontSize) > maxWidth) {
          sliceLength -= 1;
        }
        lines.push(remainder.slice(0, sliceLength));
        remainder = remainder.slice(sliceLength);
      }
      current = "";
    }

    if (current) lines.push(current);
  }

  return lines;
}

function drawTextLines(
  page: PDFPage,
  lines: string[],
  x: number,
  yTop: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineGap = 4,
) {
  let y = yTop;
  for (const line of lines) {
    page.drawText(line, { x, y: y - size, size, font, color });
    y -= size + lineGap;
  }
  return y;
}

function measureTextHeight(lineCount: number, fontSize: number, lineGap = 4) {
  if (!lineCount) return 0;
  return lineCount * fontSize + Math.max(0, lineCount - 1) * lineGap;
}

function estimateHeaderHeight(spec: UniKartPdfSpec, regularFont: PDFFont, boldFont: PDFFont) {
  const titleLines = wrapText(spec.title, boldFont, 24, CONTENT_WIDTH - 32);
  const subtitleLines = spec.subtitle ? wrapText(spec.subtitle, regularFont, 11.5, CONTENT_WIDTH - 32) : [];
  return 42 + measureTextHeight(titleLines.length, 24, 6) + measureTextHeight(subtitleLines.length, 11.5, 5) + 24;
}

function estimateMetaHeight(facts: PdfKeyValue[], regularFont: PDFFont, boldFont: PDFFont) {
  if (!facts.length) return 0;
  const columns = facts.length >= 4 ? 4 : facts.length === 3 ? 3 : 2;
  const gap = 10;
  const cellWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const rows = Math.ceil(facts.length / columns);
  let tallest = 64;

  for (const fact of facts) {
    const valueLines = wrapText(fact.value, boldFont, 11, cellWidth - 24).slice(0, 3);
    tallest = Math.max(tallest, 34 + measureTextHeight(valueLines.length, 11, 3));
  }

  return rows * tallest + Math.max(0, rows - 1) * gap;
}

function estimateSectionHeight(section: PdfSection, regularFont: PDFFont, boldFont: PDFFont) {
  let total = 52;

  if (section.summary) {
    total += measureTextHeight(wrapText(section.summary, regularFont, 10.8, CONTENT_WIDTH - 64).length, 10.8, 4) + 10;
  }

  if (section.facts?.length) {
    const rows = Math.ceil(section.facts.length / 2);
    total += rows * 54 + Math.max(0, rows - 1) * 8 + 12;
  }

  if (section.paragraphs?.length) {
    for (const paragraph of section.paragraphs) {
      total += measureTextHeight(wrapText(paragraph, regularFont, 10.4, CONTENT_WIDTH - 64).length, 10.4, 4) + 8;
    }
  }

  if (section.bullets?.length) {
    for (const bullet of section.bullets) {
      total += measureTextHeight(wrapText(bullet, regularFont, 10.2, CONTENT_WIDTH - 84).length, 10.2, 4) + 6;
    }
  }

  return Math.max(total, 94);
}

export async function createUniKartPdf(spec: UniKartPdfSpec) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(sanitize(spec.title));
  pdf.setCreator("UniKart");
  pdf.setProducer("UniKart");

  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const generatedAt = new Date().toLocaleString("en-IN");

  const pages: PDFPage[] = [];

  function createPage() {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: COLORS.page });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: COLORS.brand });
    page.drawRectangle({ x: PAGE_WIDTH - 170, y: PAGE_HEIGHT - 126, width: 118, height: 58, color: COLORS.brandSoft });
    page.drawRectangle({ x: PAGE_WIDTH - 126, y: PAGE_HEIGHT - 154, width: 74, height: 22, color: COLORS.surface });
    pages.push(page);
    return { page, y: PAGE_HEIGHT - MARGIN_TOP };
  }

  function ensureSpace(state: LayoutState, heightNeeded: number) {
    if (state.y - heightNeeded < MARGIN_BOTTOM + 10) {
      const next = createPage();
      state.page = next.page;
      state.y = next.y;
    }
  }

  function drawHeader(state: LayoutState) {
    const headerHeight = estimateHeaderHeight(spec, regularFont, boldFont);
    ensureSpace(state, headerHeight);

    const boxY = state.y - headerHeight;
    state.page.drawRectangle({
      x: MARGIN_X,
      y: boxY,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    state.page.drawRectangle({
      x: MARGIN_X,
      y: boxY + headerHeight - 34,
      width: CONTENT_WIDTH,
      height: 34,
      color: COLORS.surfaceSoft,
    });

    const eyebrow = sanitize(spec.eyebrow || "UniKart packet").toUpperCase();
    state.page.drawText(eyebrow, {
      x: MARGIN_X + 18,
      y: boxY + headerHeight - 21,
      size: 8.5,
      font: boldFont,
      color: COLORS.brandDeep,
    });

    state.page.drawText("Prepared", {
      x: PAGE_WIDTH - MARGIN_X - 104,
      y: boxY + headerHeight - 21,
      size: 8,
      font: boldFont,
      color: COLORS.muted,
    });
    state.page.drawText(generatedAt, {
      x: PAGE_WIDTH - MARGIN_X - 104,
      y: boxY + headerHeight - 34,
      size: 8.5,
      font: regularFont,
      color: COLORS.secondary,
    });

    const titleLines = wrapText(spec.title, boldFont, 24, CONTENT_WIDTH - 36);
    let cursorY = boxY + headerHeight - 52;
    cursorY = drawTextLines(state.page, titleLines, MARGIN_X + 18, cursorY, boldFont, 24, COLORS.text, 6) - 4;

    if (spec.subtitle) {
      const subtitleLines = wrapText(spec.subtitle, regularFont, 11.5, CONTENT_WIDTH - 36);
      cursorY = drawTextLines(state.page, subtitleLines, MARGIN_X + 18, cursorY, regularFont, 11.5, COLORS.secondary, 5);
    }

    state.y = boxY - 12;
  }

  function drawMetaGrid(state: LayoutState, facts: PdfKeyValue[]) {
    if (!facts.length) return;

    const columns = facts.length >= 4 ? 4 : facts.length === 3 ? 3 : 2;
    const gap = 10;
    const cellWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    const rows = Math.ceil(facts.length / columns);
    const cellHeight = Math.max(68, estimateMetaHeight(facts, regularFont, boldFont) / rows);

    ensureSpace(state, rows * cellHeight + Math.max(0, rows - 1) * gap);

    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns && index < facts.length; col += 1) {
        const fact = facts[index];
        const x = MARGIN_X + col * (cellWidth + gap);
        const y = state.y - cellHeight;
        state.page.drawRectangle({
          x,
          y,
          width: cellWidth,
          height: cellHeight,
          color: COLORS.surface,
          borderColor: COLORS.border,
          borderWidth: 1,
        });
        state.page.drawRectangle({
          x,
          y: y + cellHeight - 6,
          width: cellWidth,
          height: 6,
          color: col % 2 === 0 ? COLORS.brandSoft : COLORS.surfaceSoft,
        });
        state.page.drawText(sanitize(fact.label).toUpperCase(), {
          x: x + 12,
          y: y + cellHeight - 20,
          size: 8,
          font: boldFont,
          color: COLORS.muted,
        });
        const valueLines = wrapText(fact.value, boldFont, 11, cellWidth - 24).slice(0, 3);
        drawTextLines(state.page, valueLines, x + 12, y + cellHeight - 32, boldFont, 11, COLORS.text, 3);
        index += 1;
      }
      state.y -= cellHeight + gap;
    }

    state.y -= 4;
  }

  function drawFactPanel(page: PDFPage, fact: PdfKeyValue, x: number, y: number, width: number, palette: TonePalette) {
    page.drawRectangle({
      x,
      y,
      width,
      height: 50,
      color: palette.panel,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawText(sanitize(fact.label).toUpperCase(), {
      x: x + 10,
      y: y + 34,
      size: 7.8,
      font: boldFont,
      color: COLORS.muted,
    });
    const lines = wrapText(fact.value, regularFont, 10.2, width - 20).slice(0, 2);
    drawTextLines(page, lines, x + 10, y + 24, regularFont, 10.2, COLORS.text, 2);
  }

  function drawSection(state: LayoutState, section: PdfSection) {
    const palette = tonePalette(section.tone);
    const boxHeight = estimateSectionHeight(section, regularFont, boldFont);
    ensureSpace(state, boxHeight);

    const boxY = state.y - boxHeight;
    state.page.drawRectangle({
      x: MARGIN_X,
      y: boxY,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    state.page.drawRectangle({
      x: MARGIN_X,
      y: boxY,
      width: 6,
      height: boxHeight,
      color: palette.accent,
    });
    state.page.drawRectangle({
      x: MARGIN_X + 18,
      y: boxY + boxHeight - 28,
      width: 88,
      height: 18,
      color: palette.fill,
    });
    state.page.drawText((section.tone || "neutral").toUpperCase(), {
      x: MARGIN_X + 24,
      y: boxY + boxHeight - 22,
      size: 7.8,
      font: boldFont,
      color: palette.accent,
    });
    state.page.drawText(sanitize(section.title), {
      x: MARGIN_X + 18,
      y: boxY + boxHeight - 48,
      size: 13,
      font: boldFont,
      color: COLORS.text,
    });

    let cursorY = boxY + boxHeight - 64;

    if (section.summary) {
      const summaryLines = wrapText(section.summary, regularFont, 10.8, CONTENT_WIDTH - 64);
      cursorY = drawTextLines(state.page, summaryLines, MARGIN_X + 18, cursorY, regularFont, 10.8, COLORS.secondary, 4) - 8;
    }

    if (section.facts?.length) {
      const gap = 8;
      const cellWidth = (CONTENT_WIDTH - 46) / 2;
      section.facts.forEach((fact, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = MARGIN_X + 18 + col * (cellWidth + gap);
        const y = cursorY - row * 58 - 50;
        drawFactPanel(state.page, fact, x, y, cellWidth, palette);
      });
      cursorY -= Math.ceil(section.facts.length / 2) * 58 + 4;
    }

    if (section.paragraphs?.length) {
      for (const paragraph of section.paragraphs) {
        const paragraphLines = wrapText(paragraph, regularFont, 10.4, CONTENT_WIDTH - 64);
        cursorY = drawTextLines(state.page, paragraphLines, MARGIN_X + 18, cursorY, regularFont, 10.4, COLORS.secondary, 4) - 6;
      }
    }

    if (section.bullets?.length) {
      for (const bullet of section.bullets) {
        const bulletLines = wrapText(bullet, regularFont, 10.2, CONTENT_WIDTH - 84);
        const bulletHeight = measureTextHeight(bulletLines.length, 10.2, 4);
        state.page.drawCircle({
          x: MARGIN_X + 24,
          y: cursorY - 8,
          size: 2.3,
          color: palette.accent,
        });
        cursorY = drawTextLines(state.page, bulletLines, MARGIN_X + 34, cursorY, regularFont, 10.2, COLORS.secondary, 4) - 6;
        if (bulletHeight < 10) {
          cursorY -= 2;
        }
      }
    }

    state.y = boxY - SECTION_GAP;
  }

  const state = createPage();
  drawHeader(state);
  if (spec.meta?.length) {
    drawMetaGrid(state, spec.meta);
  }

  for (const section of spec.sections) {
    drawSection(state, section);
  }

  const footerText = sanitize(spec.footerNote || "Generated by UniKart");
  const pageCount = pages.length;

  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN_X, y: MARGIN_BOTTOM - 8 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: MARGIN_BOTTOM - 8 },
      color: COLORS.border,
      thickness: 1,
    });
    page.drawText(footerText, {
      x: MARGIN_X,
      y: MARGIN_BOTTOM - 22,
      size: 9,
      font: regularFont,
      color: COLORS.muted,
    });
    page.drawText(`Page ${index + 1} / ${pageCount}`, {
      x: PAGE_WIDTH - MARGIN_X - 54,
      y: MARGIN_BOTTOM - 22,
      size: 9,
      font: regularFont,
      color: COLORS.muted,
    });
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
