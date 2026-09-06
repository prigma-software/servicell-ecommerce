import { describe, it, expect } from "vitest";
import { formatWhatsAppPhone, maskPhoneForLogs } from "./phone.utils";

describe("phone.utils", () => {
  describe("formatWhatsAppPhone", () => {
    it("should format a standard 10-digit Colombian mobile phone", () => {
      expect(formatWhatsAppPhone("3001234567")).toBe("573001234567");
      expect(formatWhatsAppPhone("3109876543")).toBe("573109876543");
      expect(formatWhatsAppPhone("3202340616")).toBe("573202340616");
    });

    it("should handle phones with spaces, dashes, and parentheses", () => {
      expect(formatWhatsAppPhone("(300) 123-4567")).toBe("573001234567");
      expect(formatWhatsAppPhone("311 207 8781")).toBe("573112078781");
    });

    it("should handle international format with leading plus (+57)", () => {
      expect(formatWhatsAppPhone("+57 300 123 4567")).toBe("573001234567");
      expect(formatWhatsAppPhone("+573202340616")).toBe("573202340616");
    });

    it("should handle legacy 03 mobile prefix in Colombia", () => {
      expect(formatWhatsAppPhone("033001234567")).toBe("573001234567");
    });

    it("should handle numbers that already have 57 prefix", () => {
      expect(formatWhatsAppPhone("573001234567")).toBe("573001234567");
    });

    it("should return null for invalid or incomplete numbers", () => {
      expect(formatWhatsAppPhone("")).toBeNull();
      expect(formatWhatsAppPhone(null)).toBeNull();
      expect(formatWhatsAppPhone(undefined)).toBeNull();
      expect(formatWhatsAppPhone("12345")).toBeNull();
      expect(formatWhatsAppPhone("abcdefghij")).toBeNull();
    });

    it("should reject Colombian 10-digit numbers not starting with 3 (e.g. landlines)", () => {
      expect(formatWhatsAppPhone("6012345678")).toBeNull();
      expect(formatWhatsAppPhone("1234567890")).toBeNull();
    });

    it("should accept valid international numbers with different lengths", () => {
      // e.g. US/Mexico international phone with 11-13 digits
      expect(formatWhatsAppPhone("+15556593589")).toBe("15556593589");
      expect(formatWhatsAppPhone("5215512345678")).toBe("5215512345678");
    });
  });

  describe("maskPhoneForLogs", () => {
    it("should mask middle digits of a phone number", () => {
      expect(maskPhoneForLogs("573001234567")).toBe("57300****567");
      expect(maskPhoneForLogs("+57 320 234 0616")).toBe("57320****616");
    });

    it("should handle short or invalid inputs safely", () => {
      expect(maskPhoneForLogs("")).toBe("***");
      expect(maskPhoneForLogs(null)).toBe("***");
      expect(maskPhoneForLogs(undefined)).toBe("***");
      expect(maskPhoneForLogs("12345")).toBe("***");
    });
  });
});
