// المستحق التلقائي يبدأ من شهر سبتمبر (بداية العام الدراسي) حتى الشهر الحالي
export function academicStartMonth(today = new Date()): string {
  const y = today.getFullYear(), m = today.getMonth() + 1;
  return `${m >= 9 ? y : y - 1}-09`;
}
export function autoFeeApplies(month: string, active = true): boolean {
  if (!active) return false;
  const cur = new Date().toISOString().slice(0, 7);
  return month >= academicStartMonth() && month <= cur;
}
export function academicMonths(): string[] {
  const out: string[] = []; const end = new Date().toISOString().slice(0, 7);
  let [y, m] = academicStartMonth().split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= end && out.length < 24) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
