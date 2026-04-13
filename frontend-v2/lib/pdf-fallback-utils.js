"use client";

import { rgb } from "pdf-lib";

export const PDF_PAGE_WIDTH = 595.28;
export const PDF_PAGE_HEIGHT = 841.89;
export const PDF_MARGIN_X = 40;
export const PDF_MARGIN_TOP = 42;
export const PDF_MARGIN_BOTTOM = 40;
export const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN_X * 2;

export const pdfColors = {
  bg: { r: 0.972, g: 0.98, b: 0.988 },
  surface: { r: 1, g: 1, b: 1 },
  soft: { r: 0.961, g: 0.969, b: 0.984 },
  border: { r: 0.886, g: 0.91, b: 0.941 },
  borderStrong: { r: 0.796, g: 0.835, b: 0.894 },
  text: { r: 0.059, g: 0.09, b: 0.165 },
  secondary: { r: 0.2, g: 0.27, b: 0.36 },
  muted: { r: 0.392, g: 0.471, b: 0.545 },
  brand: { r: 0.384, g: 0.357, b: 1 },
  brandDeep: { r: 0.278, g: 0.247, b: 0.918 },
  brandSoft: { r: 0.937, g: 0.929, b: 1 },
  success: { r: 0.086, g: 0.639, b: 0.29 },
  successSoft: { r: 0.894, g: 0.984, b: 0.925 },
  warning: { r: 0.824, g: 0.549, b: 0.035 },
  warningSoft: { r: 0.996, g: 0.953, b: 0.78 },
  danger: { r: 0.82, g: 0.149, b: 0.149 },
  dangerSoft: { r: 0.996, g: 0.886, b: 0.886 },
};

export function toRgb(color) {
  return rgb(color.r, color.g, color.b);
}

export function savePdfBlob(bytes, fileName) {
  const objectUrl = window.URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
}

export function formatPdfCurrency(value) {
  return `INR ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

export function toPdfText(value) {
  return String(value ?? "")
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

export function wrapPdfTextByWidth(text, font, fontSize, maxWidth) {
  const paragraphs = toPdfText(text).split(/\n+/).filter(Boolean);
  if (!paragraphs.length) return [""];

  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ").filter(Boolean);
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

export function drawPdfLines(page, lines, x, yTop, font, size, color, lineGap = 4) {
  let y = yTop;
  for (const line of lines) {
    page.drawText(line, { x, y: y - size, size, font, color });
    y -= size + lineGap;
  }
  return y;
}

export function tonePalette(tone = "neutral") {
  if (tone === "brand") return { fill: pdfColors.brandSoft, panel: pdfColors.surface, accent: pdfColors.brand };
  if (tone === "success") return { fill: pdfColors.successSoft, panel: pdfColors.surface, accent: pdfColors.success };
  if (tone === "warning") return { fill: pdfColors.warningSoft, panel: pdfColors.surface, accent: pdfColors.warning };
  if (tone === "danger") return { fill: pdfColors.dangerSoft, panel: pdfColors.surface, accent: pdfColors.danger };
  return { fill: pdfColors.soft, panel: pdfColors.surface, accent: pdfColors.borderStrong };
}

export function createPdfPage(pdf) {
  const page = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT, color: toRgb(pdfColors.bg) });
  page.drawRectangle({ x: 0, y: PDF_PAGE_HEIGHT - 8, width: PDF_PAGE_WIDTH, height: 8, color: toRgb(pdfColors.brand) });
  page.drawRectangle({ x: PDF_PAGE_WIDTH - 170, y: PDF_PAGE_HEIGHT - 126, width: 118, height: 58, color: toRgb(pdfColors.brandSoft) });
  return { page, y: PDF_PAGE_HEIGHT - PDF_MARGIN_TOP };
}

export function drawPdfHeader(page, fonts, cursorY, { eyebrow, title, subtitle, metaLine }) {
  const titleLines = wrapPdfTextByWidth(title, fonts.bold, 24, PDF_CONTENT_WIDTH - 36);
  const subtitleLines = subtitle ? wrapPdfTextByWidth(subtitle, fonts.regular, 11.5, PDF_CONTENT_WIDTH - 36) : [];
  const boxHeight = 48 + titleLines.length * 30 + subtitleLines.length * 17 + (metaLine ? 18 : 0);
  const boxY = cursorY - boxHeight;

  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: boxY,
    width: PDF_CONTENT_WIDTH,
    height: boxHeight,
    color: toRgb(pdfColors.surface),
    borderColor: toRgb(pdfColors.border),
    borderWidth: 1,
  });
  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: boxY + boxHeight - 34,
    width: PDF_CONTENT_WIDTH,
    height: 34,
    color: toRgb(pdfColors.soft),
  });

  page.drawText(toPdfText(eyebrow).toUpperCase(), {
    x: PDF_MARGIN_X + 18,
    y: boxY + boxHeight - 21,
    size: 8.5,
    font: fonts.bold,
    color: toRgb(pdfColors.brandDeep),
  });

  let innerY = boxY + boxHeight - 52;
  innerY = drawPdfLines(page, titleLines, PDF_MARGIN_X + 18, innerY, fonts.bold, 24, toRgb(pdfColors.text), 6) - 4;

  if (subtitleLines.length) {
    innerY = drawPdfLines(page, subtitleLines, PDF_MARGIN_X + 18, innerY, fonts.regular, 11.5, toRgb(pdfColors.secondary), 5) - 4;
  }

  if (metaLine) {
    page.drawText(toPdfText(metaLine), {
      x: PDF_MARGIN_X + 18,
      y: innerY - 10,
      size: 8.5,
      font: fonts.regular,
      color: toRgb(pdfColors.muted),
    });
  }

  return boxY - 12;
}

export function drawPdfFactGrid(page, fonts, cursorY, facts, columns = 2) {
  if (!facts.length) return cursorY;

  const gap = 10;
  const cellWidth = (PDF_CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const rows = Math.ceil(facts.length / columns);
  const cellHeight = 70;
  let index = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns && index < facts.length; col += 1) {
      const fact = facts[index];
      const x = PDF_MARGIN_X + col * (cellWidth + gap);
      const y = cursorY - cellHeight;
      page.drawRectangle({
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        color: toRgb(pdfColors.surface),
        borderColor: toRgb(pdfColors.border),
        borderWidth: 1,
      });
      page.drawRectangle({
        x,
        y: y + cellHeight - 6,
        width: cellWidth,
        height: 6,
        color: col % 2 === 0 ? toRgb(pdfColors.brandSoft) : toRgb(pdfColors.soft),
      });
      page.drawText(toPdfText(fact.label).toUpperCase(), {
        x: x + 12,
        y: y + cellHeight - 20,
        size: 8,
        font: fonts.bold,
        color: toRgb(pdfColors.muted),
      });
      const lines = wrapPdfTextByWidth(fact.value, fonts.bold, 11, cellWidth - 24).slice(0, 3);
      drawPdfLines(page, lines, x + 12, y + cellHeight - 32, fonts.bold, 11, toRgb(pdfColors.text), 3);
      index += 1;
    }
    cursorY -= cellHeight + gap;
  }

  return cursorY - 4;
}

export function drawPdfSection(page, fonts, cursorY, { title, summary, lines = [], tone = "neutral" }) {
  const palette = tonePalette(tone);
  const wrappedLines = lines.flatMap((line) => wrapPdfTextByWidth(line, fonts.regular, 10.2, PDF_CONTENT_WIDTH - 84));
  const summaryLines = summary ? wrapPdfTextByWidth(summary, fonts.regular, 10.8, PDF_CONTENT_WIDTH - 64) : [];
  const boxHeight = Math.max(94, 54 + summaryLines.length * 15 + wrappedLines.length * 15);
  const boxY = cursorY - boxHeight;

  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: boxY,
    width: PDF_CONTENT_WIDTH,
    height: boxHeight,
    color: toRgb(pdfColors.surface),
    borderColor: toRgb(pdfColors.border),
    borderWidth: 1,
  });
  page.drawRectangle({
    x: PDF_MARGIN_X,
    y: boxY,
    width: 6,
    height: boxHeight,
    color: toRgb(palette.accent),
  });
  page.drawRectangle({
    x: PDF_MARGIN_X + 18,
    y: boxY + boxHeight - 28,
    width: 88,
    height: 18,
    color: toRgb(palette.fill),
  });
  page.drawText(String(tone).toUpperCase(), {
    x: PDF_MARGIN_X + 24,
    y: boxY + boxHeight - 22,
    size: 7.8,
    font: fonts.bold,
    color: toRgb(palette.accent),
  });
  page.drawText(toPdfText(title), {
    x: PDF_MARGIN_X + 18,
    y: boxY + boxHeight - 48,
    size: 13,
    font: fonts.bold,
    color: toRgb(pdfColors.text),
  });

  let innerY = boxY + boxHeight - 64;

  if (summaryLines.length) {
    innerY = drawPdfLines(page, summaryLines, PDF_MARGIN_X + 18, innerY, fonts.regular, 10.8, toRgb(pdfColors.secondary), 4) - 8;
  }

  for (const line of wrappedLines.length ? wrappedLines : ["No details available."]) {
    page.drawCircle({
      x: PDF_MARGIN_X + 24,
      y: innerY - 8,
      size: 2.2,
      color: toRgb(palette.accent),
    });
    innerY = drawPdfLines(page, [toPdfText(line)], PDF_MARGIN_X + 34, innerY, fonts.regular, 10.2, toRgb(pdfColors.secondary), 4) - 6;
  }

  return boxY - 14;
}

export function drawPdfFooter(page, fonts, text, pageNumber = null) {
  page.drawLine({
    start: { x: PDF_MARGIN_X, y: PDF_MARGIN_BOTTOM - 8 },
    end: { x: PDF_PAGE_WIDTH - PDF_MARGIN_X, y: PDF_MARGIN_BOTTOM - 8 },
    color: toRgb(pdfColors.border),
    thickness: 1,
  });
  page.drawText(toPdfText(text), {
    x: PDF_MARGIN_X,
    y: PDF_MARGIN_BOTTOM - 22,
    size: 9,
    font: fonts.regular,
    color: toRgb(pdfColors.muted),
  });
  if (pageNumber) {
    page.drawText(pageNumber, {
      x: PDF_PAGE_WIDTH - PDF_MARGIN_X - 52,
      y: PDF_MARGIN_BOTTOM - 22,
      size: 9,
      font: fonts.regular,
      color: toRgb(pdfColors.muted),
    });
  }
}
