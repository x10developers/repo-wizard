/**
 * File: reminder.service.js (FIXED VERSION)
 *
 * Purpose:
 * - Handles reminder persistence using Postgres (Prisma)
 */

import { prisma } from "../lib/prisma.js";
import crypto from "crypto";

/* -------------------- Create Reminder -------------------- */

export async function createReminder({
  repo_id, // ✅ Matches schema
  issue_number, // ✅ Matches schema
  message, // ✅ Matches schema
  scheduled_at, // ✅ Matches schema
  created_by, // ✅ Track who created it
}) {
  console.log("[Debug] Creating reminder:", {
    repo_id,
    issue_number,
    message,
    scheduled_at,
    created_by,
  });

  try {
    const reminder = await prisma.reminders.create({
      data: {
        id: crypto.randomUUID(), // 🔒 REQUIRED because schema has no default
        repo_id,
        issue_number,
        message,
        scheduled_at,
        status: "pending",
        retry_count: 0,
        created_by,
      },
    });

    console.log("[Success] Reminder created:", reminder.id);
    return reminder;
  } catch (error) {
    console.error("[Error] Failed to create reminder:", error);
    throw error; // Re-throw so handler can catch it
  }
}

/* -------------------- Rate Limiting -------------------- */

export async function hasRecentReminder({
  repo_id, // ✅ Matches schema
  issue_number, // ✅ Matches schema
  minutes = 5,
}) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const count = await prisma.reminders.count({
    where: {
      repo_id,
      issue_number,
      created_at: { gte: cutoff },
    },
  });

  console.log(`[Debug] Rate limit check: found ${count} recent reminders`);
  return count > 0;
}

/* -------------------- Startup Log -------------------- */

export async function logReminderIntegrity() {
  const total = await prisma.reminders.count();
  const pending = await prisma.reminders.count({
    where: { status: "pending" },
  });

  console.log(
    `[Startup] Reminder DB loaded. Total: ${total}, Pending: ${pending}`
  );
}
