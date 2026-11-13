import fontAsset from "@/assets/exam-arabic.ttf.asset.json";
import { examBlocks, type FormatExam, type FormatSettings } from "./exam-format";

// Document colors are shared with the semantic paper tokens in styles.css.
export const PAPER_PALETTES = { blue: { ink: "173E61", accent: "B8202D", band: "E1E9F2", paper: "FFFFFF", text: "171717" }, red: { ink: "973348", accent: "973348", band: "F4E4E9", paper: "FFFFFF", text: "171717" }, mono: { ink: "171717", accent: "171717", band: "EEEEEE", paper: "FFFFFF", text: "171717" } };
let fontPromise: Promise<string> | undefined;
function fontBase64() {
  fontPromise ??= fetch(fontAsset.url).then(async r => {
    if (!r.ok) throw new Error("تعذر تحميل خط التصدير العربي");
    const bytes = new Uint8Array(await r.arrayBuffer()); let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }).catch(e => { fontPromise = undefined; throw e; });
  return fontPromise;
}
export function downloadFormat(blob: Blob, title: string, answers: boolean, extension: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = `${title.replace(/[\\/:*?"<>|]/g, "-")}${answers ? " - نموذج الإجابة" : ""}.${extension}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export async function createFormatPdf(exam: FormatExam, settings: FormatSettings, answers: boolean) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.addFileToVFS("Arabic.ttf", await fontBase64()); pdf.addFont("Arabic.ttf", "Arabic", "normal"); pdf.setFont("Arabic");
  pdf.setProperties({ title: `${exam.title}${answers ? " — نموذج الإجابة" : ""}`, author: settings.header });
  const palette = settings.template === "mono" ? PAPER_PALETTES.mono : PAPER_PALETTES[settings.heading];
  const m = settings.margin + 4, width = 210 - 2 * m, bottom = 297 - m - 12;
  let y = m;
  const text = (value: string, top: number, size: number, color = palette.text, center = false) => {
    pdf.setFontSize(size); pdf.setTextColor(color); pdf.text(value, center ? 105 : 210 - m, top, { align: center ? "center" : "right" });
  };
  const frame = () => {
    pdf.setDrawColor(palette.ink); if (settings.border) pdf.roundedRect(settings.margin, settings.margin, 210 - settings.margin * 2, 297 - settings.margin * 2, 3, 3);
    text(settings.header, m + 3, 10, palette.ink, true); y = m + 11;
  };
  const footer = () => { pdf.setDrawColor(palette.ink); pdf.line(m, bottom + 4, 210 - m, bottom + 4); text(`${settings.footer} — ${pdf.getNumberOfPages()}`, bottom + 10, 9, palette.ink, true); };
  const next = () => { footer(); pdf.addPage(); frame(); };
  frame();
  const write = (value: string, size: number, color: string, centered = false) => {
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value, width);
    const height = size * 0.3528 * 1.45;
    for (const line of lines) { if (y + height > bottom) next(); text(line, y, size, color, centered); y += height; }
    y += settings.spacing;
  };
  write(`${exam.title}${answers ? " — نموذج الإجابة" : ""}`, settings.size + 4, palette.accent, true);
  write(`${exam.subject} — ${exam.grade}`, settings.size, palette.ink, true);
  write(`الزمن: ${exam.duration} دقيقة — الدرجة الكلية: ${exam.total}`, 11, palette.text, true);
  if (!answers) write("اسم الطالب: ........................................  الفصل: ............", 11, palette.text);
  for (const note of [exam.notes, settings.instructions].filter(Boolean)) write(note, 11, palette.text);
  const blocks = examBlocks(exam, settings, answers);
  blocks.forEach((block, i) => {
    const size = block.kind === "section" ? settings.size + 1 : settings.size;
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(block.text, width - 4);
    const height = size * 0.3528 * 1.45;
    // Keep headings/passages with at least the first associated question line.
    const needed = block.kind === "line" ? 7 : lines.length * height + settings.spacing + (block.keepNext && blocks[i + 1] ? height * 2 : 0);
    if (y + needed > bottom && needed < bottom - m - 11) next();
    if (block.kind === "line") { if (y + 7 > bottom) next(); pdf.setDrawColor(palette.accent); pdf.setLineDashPattern([0.3, 1], 0); pdf.line(m, y + 4, 210 - m, y + 4); pdf.setLineDashPattern([], 0); y += 7; return; }
    if (block.kind === "section") { if (y + needed > bottom) next(); pdf.setFillColor(palette.band); pdf.rect(m, y - 4, width, height + 2, "F"); }
    write(block.text, size, block.kind === "section" ? palette.ink : block.kind === "answer" ? palette.ink : palette.text);
  });
  footer();
  return pdf.output("blob");
}
export async function createFormatDocx(exam: FormatExam, settings: FormatSettings, answers: boolean) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, Header, Footer, PageNumber, ShadingType } = await import("docx");
  const palette = settings.template === "mono" ? PAPER_PALETTES.mono : PAPER_PALETTES[settings.heading];
  const paragraph = (value: string, opts: { bold?: boolean; center?: boolean; color?: string; band?: boolean; keepNext?: boolean; line?: boolean } = {}) => new Paragraph({
    bidirectional: true, alignment: opts.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    keepNext: opts.keepNext, keepLines: true,
    spacing: { after: Math.round(settings.spacing * 56.7), line: Math.round(settings.size * 20 * 1.4) },
    shading: opts.band ? { fill: palette.band, type: ShadingType.CLEAR } : undefined,
    border: opts.line ? { bottom: { style: BorderStyle.DOTTED, color: palette.accent, size: 4 } } : undefined,
    children: [new TextRun({ text: value, font: settings.font, size: settings.size * 2, bold: opts.bold, color: opts.color || palette.text, rightToLeft: true })],
  });
  const children = [paragraph(`${exam.title}${answers ? " — نموذج الإجابة" : ""}`, { bold: true, center: true, color: palette.accent }), paragraph(`${exam.subject} — ${exam.grade}`, { center: true }), paragraph(`الزمن: ${exam.duration} دقيقة — الدرجة الكلية: ${exam.total}`, { center: true })];
  if (!answers) children.push(paragraph("اسم الطالب: ................................................  الفصل: ............"));
  for (const note of [exam.notes, settings.instructions].filter(Boolean)) children.push(paragraph(note));
  for (const block of examBlocks(exam, settings, answers)) children.push(paragraph(block.text || " ", { bold: block.kind === "section", band: block.kind === "section", color: block.kind === "section" || block.kind === "answer" ? palette.ink : palette.text, keepNext: block.keepNext, line: block.kind === "line" }));
  const edge = { style: BorderStyle.SINGLE, color: palette.ink, size: 8, space: 10 };
  const doc = new Document({ styles: { default: { document: { run: { font: settings.font, size: settings.size * 2 } } } }, sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: Math.round(settings.margin * 56.7 + 350), bottom: Math.round(settings.margin * 56.7 + 350), left: Math.round(settings.margin * 56.7 + 200), right: Math.round(settings.margin * 56.7 + 200) }, borders: settings.border ? { pageBorderTop: edge, pageBorderBottom: edge, pageBorderLeft: edge, pageBorderRight: edge } : undefined } },
    headers: { default: new Header({ children: [paragraph(settings.header, { center: true, color: palette.ink })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [new TextRun({ text: settings.footer + " — ", font: settings.font, size: 18, rightToLeft: true }), new TextRun({ children: [PageNumber.CURRENT], font: settings.font, size: 18 })] })] }) }, children,
  }] });
  return Packer.toBlob(doc);
}