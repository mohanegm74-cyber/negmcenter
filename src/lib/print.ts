import { LOGO_URL } from "@/components/BrandLogo";

// Open a print window with beautifully styled Arabic content, ready to Save as PDF.
export function openPrint(title: string, bodyHtml: string, extraCss = "") {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const logoAbs = new URL(LOGO_URL, window.location.origin).href;
  w.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; font-family: 'Cairo', system-ui, sans-serif; color:#0f172a; background:#f8fafc; }
  .sheet { background:#fff; padding:24px; max-width: 900px; margin: 16px auto; box-shadow:0 4px 24px rgba(0,0,0,.06); border-radius:12px; }
  .brand { display:flex; align-items:center; gap:12px; border-bottom:2px solid #1e3a8a; padding-bottom:12px; margin-bottom:16px; }
  .brand img { width:56px; height:56px; border-radius:10px; object-fit:contain; }
  .brand h1 { margin:0; font-size:18px; font-weight:900; color:#1e3a8a; }
  .brand p { margin:2px 0 0; font-size:12px; color:#64748b; }
  h2 { margin:0 0 12px; font-size:16px; color:#0f172a; }
  table { width:100%; border-collapse: collapse; font-size:12px; }
  th, td { border:1px solid #cbd5e1; padding:8px 10px; text-align:right; }
  thead th { background:#1e3a8a; color:#fff; font-weight:700; }
  tbody tr:nth-child(even) { background:#f1f5f9; }
  .footer { margin-top:16px; text-align:center; font-size:11px; color:#64748b; border-top:1px dashed #cbd5e1; padding-top:8px; }
  .toolbar { max-width:900px; margin:12px auto; text-align:left; }
  .toolbar button { background:#1e3a8a; color:#fff; border:0; padding:8px 16px; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
  @media print { .toolbar { display:none; } .sheet { box-shadow:none; margin:0; border-radius:0; } body { background:#fff; } }
  ${extraCss}
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>
<div class="sheet">
  <div class="brand">
    <img src="${logoAbs}" alt="logo"/>
    <div>
      <h1>سنتر الأستاذ محمد نجم</h1>
      <p>${title}</p>
    </div>
    <div style="margin-inline-start:auto; font-size:11px; color:#64748b;">${new Date().toLocaleDateString("ar-EG")}</div>
  </div>
  ${bodyHtml}
  <div class="footer">© سنتر الأستاذ محمد نجم — منصة إدارة السنتر التعليمي</div>
</div>
</body></html>`);
  w.document.close();
}

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
