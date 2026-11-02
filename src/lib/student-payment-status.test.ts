import { describe, expect, it } from "vitest";
import { isStudentSettled } from "./student-payment-status";

describe("student settlement", () => {
  it("is settled when nothing remains after payments and exemptions", () => {
    expect(isStudentSettled(0)).toBe(true);
  });
  it("is unsettled when an amount remains, including partial payments", () => {
    expect(isStudentSettled(50)).toBe(false);
  });
  it("is settled when recorded payments exceed dues", () => {
    expect(isStudentSettled(-20)).toBe(true);
  });
});