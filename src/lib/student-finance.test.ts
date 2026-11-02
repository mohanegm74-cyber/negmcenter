import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { studentFinanceSummary } from "./student-finance";

describe("student monthly finance", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T19:05:00Z")); });
  afterEach(() => vi.useRealTimers());
  it("shows dues for the current month only using recorded charges", () => {
    expect(studentFinanceSummary([{ month: "2026-10", kind: "charge", amount: 200 }, { month: "2026-11", kind: "charge", amount: 120 }], 100).current.due).toBe(120);
  });
  it("shows payments for the current month only", () => {
    expect(studentFinanceSummary([{ month: "2026-10", kind: "payment", amount: 80 }, { month: "2026-11", kind: "payment", amount: 30 }], 100).current.paid).toBe(30);
  });
  it("shows exemptions for the current month only", () => {
    expect(studentFinanceSummary([{ month: "2026-10", kind: "exempt", amount: 100 }, { month: "2026-11", kind: "exempt", amount: 20 }], 100).current.exempt).toBe(20);
  });
  it("totals remaining across academic and historical recorded months without transferring excess payments", () => {
    const summary = studentFinanceSummary([
      { month: "2026-08", kind: "charge", amount: 40 },
      { month: "2026-09", kind: "payment", amount: 70 },
      { month: "2026-10", kind: "payment", amount: 30 },
      { month: "2026-11", kind: "exempt", amount: 20 },
    ], 100);
    expect(summary.remaining).toBe(190); // August 40 + September 0 + October 70 + November 80
  });
  it("preserves the September default of 50 Egyptian pounds", () => {
    vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
    expect(studentFinanceSummary([], 100).current.due).toBe(50);
  });
});