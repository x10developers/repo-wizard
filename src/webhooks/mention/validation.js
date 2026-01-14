/**
 * Validation logic for reminders
 */

import { parseReminder } from "../../reminders/reminder.parser.js";
import { hasRecentReminder } from "../../reminders/reminder.service.js";
import { ValidationError } from "../../utils/errors.js";

/**
 * Check if command text starts with a valid prefix
 */
export function isValidCommand(body) {
  const normalized = body.toLowerCase().trim();
  const allowedPrefixes = [
    "/reporeply",
    "@reporeply",
    "reporeply",
    ".reporeply",
    ",reporeply",
    "#reporeply",
  ];

  return allowedPrefixes.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Check if command is an admin command
 */
export function isAdminCommand(body) {
  const normalized = body.toLowerCase().trim();
  return normalized.startsWith("/reporeply admin");
}

/**
 * Extract command text by removing prefixes
 */
export function extractCommandText(body) {
  return body
    .replace(/^\/reporeply\s+admin/i, "")
    .replace(/^\/reporeply/i, "")
    .replace(/^@reporeply/i, "")
    .replace(/^reporeply/i, "")
    .replace(/^\.reporeply/i, "")
    .replace(/^,reporeply/i, "")
    .replace(/^#reporeply/i, "")
    .trim();
}

/**
 * Check rate limiting for reminder creation
 */
export async function checkRateLimiting({
  repo_id,
  issue_number,
  minutes = 10,
}) {
  try {
    const limited = await hasRecentReminder({
      repo_id,
      issue_number,
      minutes,
    });

    if (limited) {
      throw new ValidationError(
        "⏱️ Reminder request limited.\n\n" +
          "A reminder was created recently for this issue. " +
          `Please wait at least ${minutes} minutes before creating another reminder.`
      );
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    console.error("[Error] Rate limit check failed:", err);
  }
}

/**
 * Parse and validate reminder from command text
 */
export function parseAndValidateReminder(commandText, now = Date.now()) {
  const nowDate = new Date(now);

  // Parse the reminder
  const parsed = parseReminder(commandText, nowDate);

  if (!parsed) {
    throw new ValidationError(
      "Unable to create reminder.\n\n" +
        "The reminder format could not be understood.\n\n" +
        "Examples:\n" +
        "- /reporeply notify me tomorrow at 5pm\n" +
        "- /reporeply remind me in 10 minutes\n" +
        "- /reporeply alert me next Monday"
    );
  }

  return { parsed, now };
}

/**
 * Validate reminder time constraints
 */
export function validateReminderTime(remindAt, now = Date.now()) {
  const MIN_DELAY_MINUTES = 16;
  const DISPLAY_MINUTES = 15;
  const MAX_DAYS_AHEAD = 8;

  const remindAtTime = new Date(remindAt).getTime();
  const minAllowedTime = now + MIN_DELAY_MINUTES * 60 * 1000;
  const maxAllowedTime = now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

  // Check minimum time
  if (remindAtTime < minAllowedTime) {
    throw new ValidationError(
      "⏰ Reminder could not be scheduled.\n\n" +
        `Reminders must be scheduled at least ${DISPLAY_MINUTES} minutes in advance.\n\n` +
        "Please choose a later time and try again."
    );
  }

  // Check maximum time
  if (remindAtTime > maxAllowedTime) {
    throw new ValidationError(
      "📅 Reminder could not be scheduled.\n\n" +
        "Reminders can only be created for up to 7 days in advance.\n\n" +
        "Please choose a date within the next week and try again."
    );
  }
}

/**
 * Complete validation flow for a reminder
 */
export async function validateReminder({
  commandText,
  repo_id,
  issue_number,
  skipRateLimit = false,
}) {
  // Parse reminder
  const { parsed, now } = parseAndValidateReminder(commandText);

  // Validate time constraints
  validateReminderTime(parsed.remindAt, now);

  // Check rate limiting
  if (!skipRateLimit) {
    await checkRateLimiting({ repo_id, issue_number, minutes: 10 });
  }

  return parsed;
}
