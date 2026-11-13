// Cleans Arabic text pasted/extracted from PDF sources so it renders clearly:
// converts presentation-form glyphs to normal letters, removes tatweel and invisible marks.
export function cleanArabic(s: unknown): string {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}
