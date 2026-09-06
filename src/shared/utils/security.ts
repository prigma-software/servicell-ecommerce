/**
 * Utility functions for input sanitization and security hardening.
 */

/**
 * Sanitizes user search input before inserting into PostgREST .or() or .ilike() filter queries.
 * - Truncates to a safe maximum length (default 80 characters) to prevent CPU exhaustion on wildcard scans.
 * - Strips structural PostgREST and SQL LIKE metacharacters: [ , ( ) " ' \ % _ : ; ]
 * - Trims surrounding whitespace.
 */
export function sanitizeSearchTerm(term: string | null | undefined, maxLength: number = 80): string {
  if (!term || typeof term !== "string") return "";
  return term
    .trim()
    .slice(0, maxLength)
    .replace(/[,()"\\%_:;']/g, "")
    .trim();
}
