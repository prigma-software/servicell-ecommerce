/**
 * Utility functions for phone number normalization and PII masking.
 * Formats phones to the strict international standard required by Meta WhatsApp Cloud API (no '+', no spaces, no dashes).
 */

/**
 * Normalizes a phone number to WhatsApp international format (E.164 without leading '+').
 * Examples for Colombia (defaultCountryCode = '57'):
 * - "300 123 4567" -> "573001234567"
 * - "+57 300 123 4567" -> "573001234567"
 * - "033001234567" -> "573001234567"
 * - "573001234567" -> "573001234567"
 * 
 * Returns null if the phone is invalid, too short or cannot be safely formatted.
 */
export function formatWhatsAppPhone(
  phone: string | null | undefined,
  defaultCountryCode = "57"
): string | null {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");

  if (!cleaned) {
    return null;
  }

  // Handle Colombia legacy prefix '03' (e.g. 033001234567 -> 3001234567)
  if (defaultCountryCode === "57" && cleaned.startsWith("03") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  }

  // If already starts with country code
  if (cleaned.startsWith(defaultCountryCode)) {
    // For Colombia: 57 + 10 digits = 12 digits
    if (defaultCountryCode === "57" && cleaned.length === 12 && cleaned.startsWith("573")) {
      return cleaned;
    }
    // Generic validation for other countries: total length between 10 and 15 digits
    if (cleaned.length >= 10 && cleaned.length <= 15) {
      return cleaned;
    }
  }

  // If local 10-digit number (e.g. Colombian mobile: 3001234567)
  if (cleaned.length === 10) {
    // For Colombia, mobile numbers start with '3'
    if (defaultCountryCode === "57" && !cleaned.startsWith("3")) {
      // Landline or invalid mobile prefix for WhatsApp
      return null;
    }
    return `${defaultCountryCode}${cleaned}`;
  }

  // If already international format without '+' for other countries (11-15 digits)
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return cleaned;
  }

  return null;
}

/**
 * Masks a phone number to protect customer PII in console and observability logs.
 * Example: "573001234567" -> "57300****567"
 */
export function maskPhoneForLogs(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") {
    return "***";
  }

  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 8) {
    return "***";
  }

  const prefix = cleaned.slice(0, 5);
  const suffix = cleaned.slice(-3);
  return `${prefix}****${suffix}`;
}
