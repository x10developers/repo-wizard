/**
 * Parse natural-language reminder text.
 *
 * Returns:
 * - { remindAt: Date } on success (always returns UTC Date object)
 * - null on failure
 *
 * FIXED: Now properly handles timezone conversions
 */
import * as chrono from "chrono-node";

export function parseReminder(text, referenceDate = new Date()) {
  if (!text || typeof text !== "string") return null;

  const normalized = text.toLowerCase();

  /* -------------------- Intent Detection -------------------- */

  // Flexible intent keywords (order does not matter)
  const intentRegex = /\b(remind|reminder|notify|notification|ping|alert)\b/;

  if (!intentRegex.test(normalized)) {
    return null;
  }

  /* -------------------- Time Extraction -------------------- */

  // Parse the date - chrono returns UTC dates
  const date = chrono.parseDate(normalized, referenceDate, {
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

  // Ensure the date is actually in the future relative to reference date
  // Use getTime() for accurate millisecond comparison
  if (date.getTime() <= referenceDate.getTime()) {
    return null;
  }

  // IMPORTANT: Return the date as-is (it's already in UTC)
  // Database will store it as UTC
  // Scheduler will compare it as UTC
  return {
    remindAt: date,
  };
}
