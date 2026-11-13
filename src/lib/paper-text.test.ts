import { describe, it, expect } from "vitest";
import { cleanArabic } from "./paper-text";
describe("cleanArabic", () => {
  it("converts PDF presentation forms to normal Arabic letters", () => {
    expect(cleanArabic("\uFEE3\uFEA4\uFEE4\uFEA9")).toBe("محمد");
  });
  it("removes tatweel and invisible direction marks", () => {
    expect(cleanArabic("نـــجم\u200F  الأستاذ")).toBe("نجم الأستاذ");
  });
});
