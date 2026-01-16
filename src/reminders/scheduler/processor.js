/**
 * scheduler/processor.js
 *
 * Purpose: Core reminder processing logic
 * Handles reminder execution, validation, and failure recovery
 */

import { prisma } from "../../lib/prisma.js";
import { postGitHubComment } from "./github-client.js";
import {
  getNextRetryDelay,
  shouldMarkAsDead,
  calculateNextScheduledAt,
} from "./retry.js";
import { incrementProcessing, decrementProcessing, state } from "./state.js";

/* -------------------- Process Single Reminder -------------------- */
export async function processReminder(reminder, now) {
  incrementProcessing();

  try {
    /* -------------------- Optimistic Locking -------------------- */
    // Optimistic locking
    const locked = await prisma.reminders.updateMany({
      where: {
        id: reminder.id,
        status: "pending",
      },
      data: {
        status: "processing",
        updated_at: new Date(),
      },
    });

    if (locked.count === 0) {
      console.log(`[Reminder] ${reminder.id} already locked`);
      return;
    }

    /* -------------------- Validate Repository -------------------- */
    // Validate repository
    const repo = await prisma.repositories.findUnique({
      where: { id: reminder.repo_id },
      select: { is_active: true },
    });

    if (!repo?.is_active) {
      await markAsInactive(reminder);
      return;
    }

    /* -------------------- Send Reminder -------------------- */
    // Send reminder
    await postGitHubComment({
      repo: reminder.repo_id,
      issueNumber: reminder.issue_number,
      message: reminder.message || "🔔 Reminder",
    });

    await markAsSent(reminder);
  } catch (err) {
    /* -------------------- Error Handling -------------------- */
    await handleFailure(reminder, err);
  } finally {
    /* -------------------- Cleanup -------------------- */
    decrementProcessing();
  }
}

/* -------------------- Mark Reminder as Inactive -------------------- */
async function markAsInactive(reminder) {
  await prisma.reminders.update({
    where: { id: reminder.id },
    data: {
      status: "dead",
      error: "Repository is inactive or deleted",
      updated_at: new Date(),
    },
  });
}

/* -------------------- Mark Reminder as Sent -------------------- */
async function markAsSent(reminder) {
  await prisma.reminders.update({
    where: { id: reminder.id },
    data: {
      status: "sent",
      sent_at: new Date(),
      updated_at: new Date(),
    },
  });

  await prisma.audit_logs.create({
    data: {
      repo_id: reminder.repo_id,
      action: "REMINDER_SENT",
      meta: {
        reminderId: reminder.id,
        issueNumber: Number(reminder.issue_number),
      },
    },
  });

  console.log(`[Reminder]  ✅ Sent: ${reminder.id}`);
}

/* -------------------- Handle Reminder Failure -------------------- */
async function handleFailure(reminder, err) {
  const nextRetry = reminder.retry_count + 1;
  const isPermanentError = err.message?.includes("PERMANENT");
  const isDead = shouldMarkAsDead(nextRetry, isPermanentError);
  const nextScheduledAt = calculateNextScheduledAt(nextRetry, isDead);

  await prisma.reminders.update({
    where: { id: reminder.id },
    data: {
      status: isDead ? "dead" : "failed",
      retry_count: nextRetry,
      error: String(err.message || err).substring(0, 500),
      scheduled_at: nextScheduledAt || reminder.scheduled_at,
      last_retry_at: new Date(),
      updated_at: new Date(),
    },
  });

  await prisma.audit_logs.create({
    data: {
      repo_id: reminder.repo_id,
      action: isDead ? "REMINDER_DEAD" : "REMINDER_FAILED",
      meta: {
        reminderId: reminder.id,
        retry: Number(nextRetry),
        error: String(err.message || err).substring(0, 500),
        nextRetryIn: isDead ? null : `${getNextRetryDelay(nextRetry)} minutes`,
      },
    },
  });

  console.error(
    `[Reminder] ${isDead ? "☠️ Dead" : "⚠️ Failed"}: ${
      reminder.id
    }, retry=${nextRetry}`,
    err.message
  );
}
