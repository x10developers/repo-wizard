/**
 * File: reminder.service.js
 *
 * Purpose:
 * - Handles reminder persistence and lookup.
 *
 * Responsibilities:
 * - Load reminders from disk
 * - Save reminders to disk
 * - Auto-backup reminders
 * - Auto-recover from backup if main file is missing or corrupted
 * - Enforce recent-reminder checks (rate limiting)
 */

import fs from "fs";
import path from "path";

/* -------------------- Paths & Constants -------------------- */

const DATA_DIR = path.join(process.cwd(), "data", "reminders");
const FILE_PATH = path.join(DATA_DIR, "reminders.json");
const BACKUP_PREFIX = "reminders.backup.";
const MAX_BACKUPS = 5;

/* -------------------- Ensure Data Directory Exists -------------------- */

// IMPORTANT: Must exist before any read/write
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/* -------------------- Helpers -------------------- */

/**
 * Get all backup files sorted (newest first)
 */
function getBackupFiles() {
  return fs
    .readdirSync(DATA_DIR)
    .filter(
      (f) =>
        f.startsWith(BACKUP_PREFIX) && f.endsWith(".json")
    )
    .sort()
    .reverse();
}

/**
 * Attempt to recover reminders.json from the latest backup
 */
function recoverFromBackup() {
  const backups = getBackupFiles();
  if (backups.length === 0) return [];

  try {
    const latestBackup = path.join(DATA_DIR, backups[0]);
    const data = fs.readFileSync(latestBackup, "utf8");

    fs.writeFileSync(FILE_PATH, data);

    console.warn(
      `[Recovery] Restored reminders from backup: ${backups[0]}`
    );

    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Create a dated backup and keep only the latest N backups
 */
function createBackup(data) {
  const date = new Date().toISOString().split("T")[0];
  const backupPath = path.join(
    DATA_DIR,
    `${BACKUP_PREFIX}${date}.json`
  );

  fs.writeFileSync(backupPath, data);

  // Cleanup old backups
  const backups = getBackupFiles();
  backups.slice(MAX_BACKUPS).forEach((file) => {
    fs.unlinkSync(path.join(DATA_DIR, file));
  });
}

/* -------------------- Core API -------------------- */

export function loadReminders() {
  if (!fs.existsSync(FILE_PATH)) {
    return recoverFromBackup();
  }

  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  } catch {
    return recoverFromBackup();
  }
}

export function saveReminders(reminders) {
  const data = JSON.stringify(reminders, null, 2);

  // Save primary file
  fs.writeFileSync(FILE_PATH, data);

  // Create backup
  createBackup(data);
}

export function createReminder(reminder) {
  const reminders = loadReminders();

  reminders.push({
    ...reminder,
    sent: false,
    createdAt: new Date().toISOString(),
  });

  saveReminders(reminders);
}

/**
 * Check if a reminder was recently created
 * (used for rate limiting)
 */
export function hasRecentReminder({
  repo,
  issue,
  user,
  minutes = 5,
}) {
  const reminders = loadReminders();
  const cutoff = Date.now() - minutes * 60 * 1000;

  return reminders.some((r) => {
    return (
      r.repo === repo &&
      r.issue === issue &&
      r.user === user &&
      new Date(r.createdAt).getTime() >= cutoff
    );
  });
}

/**
 * Log reminder storage health at startup
 */
export function logReminderIntegrity() {
  try {
    const reminders = loadReminders();
    const pending = reminders.filter(r => !r.sent).length;

    console.log(
      `[Startup] Reminder store loaded successfully. Total: ${reminders.length}, Pending: ${pending}`
    );
  } catch (err) {
    console.error(
      "[Startup] Failed to load reminder store:",
      err.message
    );
  }
}
