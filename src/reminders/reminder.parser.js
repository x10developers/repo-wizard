import * as chrono from "chrono-node";

/**
 * Parse natural-language reminder text.
 *
 * Returns:
 * - { remindAt: Date } on success
 * - null on failure
 */
export function parseReminder(text) {
  if (!text || typeof text !== "string") return null;

  const normalized = text.toLowerCase();

  /* -------------------- Intent Detection -------------------- */

  // Flexible intent keywords (order does not matter)
  const intentRegex = /\b(remind|reminder|notify|notification|ping|alert)\b/;

  if (!intentRegex.test(normalized)) {
    return null;
  }

  /* -------------------- Time Extraction -------------------- */

  const date = chrono.parseDate(normalized, new Date(), {
    forwardDate: true, // always future dates
  });

  if (!date) {
    return null;
  }

  /* -------------------- Validation -------------------- */

  // Must be a valid future date
  if (isNaN(date.getTime())) {
    return null;
  }

  return {
    remindAt: date,
  };
}
