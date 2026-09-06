import { describe, it, expect } from "vitest";
import { sanitizeSearchTerm } from "./security";

describe("sanitizeSearchTerm", () => {
  it("should return empty string for null, undefined or non-string inputs", () => {
    expect(sanitizeSearchTerm(null)).toBe("");
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm("" as unknown as string)).toBe("");
  });

  it("should strip PostgREST metacharacters and control characters", () => {
    const maliciousInput = 'customer,name.ilike.%test%)"\'\\;_:';
    const sanitized = sanitizeSearchTerm(maliciousInput);
    expect(sanitized).toBe("customername.ilike.test");
    expect(sanitized).not.toContain(",");
    expect(sanitized).not.toContain("(");
    expect(sanitized).not.toContain(")");
    expect(sanitized).not.toContain('"');
    expect(sanitized).not.toContain("'");
    expect(sanitized).not.toContain("\\");
    expect(sanitized).not.toContain(";");
    expect(sanitized).not.toContain("_");
    expect(sanitized).not.toContain(":");
    expect(sanitized).not.toContain("%");
  });

  it("should truncate strings longer than maxLength", () => {
    const longInput = "a".repeat(120);
    const sanitized = sanitizeSearchTerm(longInput, 80);
    expect(sanitized.length).toBe(80);
  });

  it("should preserve normal alphanumeric search terms with spaces and hyphens", () => {
    const normalInput = "  Vitamin C 500mg - Pack x3  ";
    expect(sanitizeSearchTerm(normalInput)).toBe("Vitamin C 500mg - Pack x3");
  });
});
