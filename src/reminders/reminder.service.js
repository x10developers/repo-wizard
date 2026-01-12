/**
 * File: reminder.service.js
 *
 * Purpose:
 * - Handles reminder persistence using Postgres (Prisma)
 */

import { prisma } from "../lib/prisma.js";
import crypto from "crypto";

/* -------------------- Create Reminder -------------------- */

export async function createReminder({
  repo_id,
  issue_number,
  user,
  message,
  scheduled_at,
}) {
  return prisma.reminders.create({
    data: {
      id: crypto.randomUUID(), // 🔑 REQUIRED because schema has no default
      repo_id,
      issue_number,
      message,
      scheduled_at,
      status: "pending",
      retry_count: 0,
    },
  });
}

/* -------------------- Rate Limiting -------------------- */

export async function hasRecentReminder({
  repo_id,
  issue_number,
  user,
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
