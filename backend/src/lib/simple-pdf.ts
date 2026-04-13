function sanitize(text: string) {
  return String(text)
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .trim();
}

function wrapLine(input: string, maxLength = 88) {
  const text = sanitize(input);
  if (text.length <= maxLength) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function createSimplePdf(title: string, rawLines: string[]) {
  const lines = [sanitize(title), "", ...rawLines.flatMap((line) => wrapLine(line))].slice(0, 60);
  const contentLines: string[] = [];
  let y = 800;

  contentLines.push("BT");
  contentLines.push("/F1 18 Tf");
  contentLines.push(`40 ${y} Td`);
  contentLines.push(`(${lines[0] || "UniKart"}) Tj`);
  y -= 28;
  contentLines.push("/F1 11 Tf");

  for (const line of lines.slice(1)) {
    contentLines.push(`1 0 0 1 40 ${y} Tm`);
    contentLines.push(`(${line}) Tj`);
    y -= line ? 16 : 10;
    if (y < 40) break;
  }

  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}
