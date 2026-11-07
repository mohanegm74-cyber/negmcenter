export type GroupListStatus = "paid" | "unpaid" | "exempt";
export type GroupListFilter = "all" | GroupListStatus;

export function groupListStatus(paid: number, exempt: number, target: number): GroupListStatus {
  if (exempt > 0 && exempt >= target - paid && paid === 0) return "exempt";
  if (paid > 0 && paid + exempt >= target) return "paid";
  return "unpaid";
}

export function selectGroupList<T extends { full_name: string; statusKey: GroupListStatus }>(rows: T[], filter: GroupListFilter) {
  return rows.filter(row => filter === "all" || row.statusKey === filter)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
}

// Scoped to group lists; other printable documents keep their existing layout.
export const groupListPrintCss = `
  @page { size: A4 portrait; margin: 10mm; }
  .sheet { max-width: 190mm; padding: 10px; border-radius: 0; }
  .brand { margin-bottom: 8px; padding-bottom: 6px; }
  .brand img { width: 40px; height: 40px; }
  .brand h1 { font-size: 15px; }
  .list-summary { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 11px; }
  .list-summary h2 { margin: 0 0 4px; font-size: 14px; }
  .list-summary p, .list-signatures p { margin: 0; }
  table { table-layout: fixed; }
  table th, table td { font-size: 11px; padding: 4px 5px; line-height: 1.5; overflow-wrap: anywhere; }
  tbody tr { break-inside: avoid; }
  .print-badge { font-weight: 700; }
  tbody tr.status-paid { background: var(--list-paid-soft); color: var(--list-paid); }
  tbody tr.status-unpaid { background: var(--list-unpaid-soft); color: var(--list-unpaid); }
  tbody tr.status-exempt { background: var(--list-exempt-soft); color: var(--list-exempt); }
  tbody tr.status-partial { background: var(--list-partial-soft); color: var(--list-partial); }
  .list-signatures { display: flex; justify-content: space-between; margin-top: 12px; font-size: 10px; }
  .footer { margin-top: 8px; padding-top: 5px; font-size: 9px; }
  @media print {
    html, body { width: 190mm; }
    .sheet { width: 190mm; max-width: none; margin: 0; box-shadow: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export const groupListFitScript = `<script>
  function fitGroupList() {
    const sheet = document.querySelector('.sheet');
    if (!sheet) return;
    sheet.style.zoom = '1';
    const probe = document.createElement('div');
    probe.style.height = '275mm';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const available = probe.getBoundingClientRect().height;
    probe.remove();
    sheet.style.zoom = String(Math.min(1, available / Math.max(sheet.scrollHeight, sheet.getBoundingClientRect().height)));
  }
  document.fonts.ready.then(fitGroupList);
  window.addEventListener('load', fitGroupList);
  window.addEventListener('beforeprint', fitGroupList);
</script>`;