/**
 * File: reminders/reminder.scheduler.js
 *
 * Features:
 * - GitHub reminder delivery
 * - Scheduler lock (no double execution)
 * - Max retry cap (>=5 → dead)
 * - Audit logs
 * - Daily metrics aggregation
 * - Notification fan-out (Telegram ready, Email stub)
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";

/* --------------------------------------------- */
/* GitHub delivery                               */
/* --------------------------------------------- */
async function postGitHubComment({ repo, issueNumber, message }) {
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ body: message }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API failed: ${res.status} ${text}`);
  }
}

/* --------------------------------------------- */
/* Notifications                                 */
/* --------------------------------------------- */
async function notifyTelegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
    }),
  });
}

// Email stub (plug later)
async function notifyEmail(_text) {
  // integrate nodemailer / SES later
}

/* --------------------------------------------- */
/* Metrics aggregation                           */
/* --------------------------------------------- */
async function sendDailyMetrics() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const [sent, failed, dead] = await Promise.all([
    prisma.reminders.count({
      where: { status: "sent", sent_at: { gte: start, lte: end } },
    }),
    prisma.reminders.count({
      where: { status: "failed", created_at: { gte: start, lte: end } },
    }),
    prisma.reminders.count({
      where: { status: "dead", created_at: { gte: start, lte: end } },
    }),
  ]);

  const summary =
    `📊 *RepoReply Daily Reminder Metrics*\n\n` +
    `✅ Sent: ${sent}\n` +
    `⚠️ Failed: ${failed}\n` +
    `☠️ Dead: ${dead}`;

  await notifyTelegram(summary);
  await notifyEmail(summary);
}

/* --------------------------------------------- */
/* Scheduler                                     */
/* --------------------------------------------- */
async function runScheduler() {
  console.log("[Metric] scheduler.status=running");

  const now = new Date();

  const dueReminders = await prisma.reminders.findMany({
    where: {
      status: "pending",
      sent_at: null,
      scheduled_at: { lte: now },
      retry_count: { lt: 5 },
    },
    orderBy: { scheduled_at: "asc" },
  });

  console.log(`[Metric] reminders.checked=${dueReminders.length}`);

  for (const reminder of dueReminders) {
    /* -------- Scheduler lock -------- */
    const locked = await prisma.reminders.updateMany({
      where: {
        id: reminder.id,
        status: "pending",
      },
      data: {
        status: "processing",
      },
    });

    if (locked.count === 0) continue;

    try {
      await postGitHubComment({
        repo: reminder.repo_id,
        issueNumber: reminder.issue_number,
        message: reminder.message,
      });

      await prisma.reminders.update({
        where: { id: reminder.id },
        data: {
          status: "sent",
          sent_at: new Date(),
        },
      });

      await prisma.audit_logs.create({
        data: {
          repo_id: reminder.repo_id,
          action: "REMINDER_SENT",
          meta: { reminderId: reminder.id },
        },
      });

      console.log(
        `[Metric] reminders.sent=1 repo=${reminder.repo_id} issue=${reminder.issue_number}`
      );
    } catch (err) {
      const nextRetry = reminder.retry_count + 1;
      const isDead = nextRetry >= 5;

      await prisma.reminders.update({
        where: { id: reminder.id },
        data: {
          status: isDead ? "dead" : "failed",
          retry_count: nextRetry,
          error: String(err),
        },
      });

      await prisma.audit_logs.create({
        data: {
          repo_id: reminder.repo_id,
          action: isDead ? "REMINDER_DEAD" : "REMINDER_FAILED",
          meta: {
            reminderId: reminder.id,
            retry: nextRetry,
            error: String(err),
          },
        },
      });

      console.error(
        `[Error] reminder.${isDead ? "dead" : "failed"} id=${reminder.id}`,
        err
      );
    }
  }

  await sendDailyMetrics();
}

/* --------------------------------------------- */
/* Entrypoint                                    */
/* --------------------------------------------- */
runScheduler()
  .catch((err) => {
    console.error("[Fatal] scheduler.crashed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
