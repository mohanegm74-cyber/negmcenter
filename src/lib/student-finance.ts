import { academicMonths, autoFee } from "./fees";

type Payment = { month: string | null; kind: string; amount: number | string };

/** Same monthly ledger rules as teacher finance, applied only to this student. */
export function studentFinanceSummary(payments: Payment[], groupFee: number, active = true) {
  const month = new Date().toISOString().slice(0, 7);
  const months = new Set([...academicMonths(), ...payments.flatMap((p) => p.month ? [p.month] : [])]);
  const calculate = (month: string) => {
    const rows = payments.filter((p) => p.month === month);
    const sum = (kind: string) => rows.filter((p) => p.kind === kind).reduce((total, p) => total + Number(p.amount), 0);
    const charge = sum("charge");
    const due = charge > 0 ? charge : autoFee(month, groupFee, active);
    const paid = sum("payment"), exempt = sum("exempt");
    return { due, paid, exempt, remaining: Math.max(0, due - paid - exempt) };
  };
  return {
    month,
    current: calculate(month),
    remaining: [...months].reduce((total, month) => total + calculate(month).remaining, 0),
  };
}