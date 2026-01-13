/**
 * File: reminder.scheduler.js (IMPROVED)
 *
 * Improvements:
 * - Better error categorization (transient vs permanent)
 * - Exponential backoff for retries
 * - Repository validation before sending
 * - Better metrics tracking
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
    
    // Check if it's a permanent error
    if (res.status === 404 || res.status === 410) {
      throw new Error(`PERMANENT: Issue not found or deleted (${res.status})`);
    }
    
    throw new Error(`GitHub API failed: ${res.status} ${text}`);
  }
  
  return await res.json();
}

/* --------------------------------------------- */
/* Notifications                                 */
/* --------------------------------------------- */
async function notifyTelegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;

  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("[Error] Telegram notification failed:", err.message);
  }
}

async function notifyEmail(_text) {
  // TODO: integrate nodemailer / SES
}

/* --------------------------------------------- */
/* Metrics aggregation                           */
/* --------------------------------------------- */
async function sendDailyMetrics() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const [sent, failed, dead, pending] = await Promise.all([
    prisma.reminders.count({
      where: { status: "sent", sent_at: { gte: start, lte: end } },
    }),
    prisma.reminders.count({
      where: { status: "failed", updated_at: { gte: start, lte: end } },
    }),
    prisma.reminders.count({
      where: { status: "dead", updated_at: { gte: start, lte: end } },
    }),
    prisma.reminders.count({
      where: { status: "pending", scheduled_at: { lte: end } },
    }),
  ]);

  const summary =
    `📊 *RepoReply Daily Reminder Metrics*\n\n` +
    `✅ Sent: ${sent}\n` +
    `⚠️ Failed: ${failed}\n` +
    `☠️ Dead: ${dead}\n` +
    `⏳ Pending: ${pending}`;

  await notifyTelegram(summary);
  await notifyEmail(summary);
}

/* --------------------------------------------- */
/* Calculate next retry delay (exponential backoff) */
/* --------------------------------------------- */
function getNextRetryDelay(retryCount) {
  // 5min, 15min, 30min, 1hr, 2hr
  const delays = [5, 15, 30, 60, 120];
  return delays[Math.min(retryCount, delays.length - 1)];
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
    take: 50, // Process in batches
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
        updated_at: new Date(),
      },
    });

    if (locked.count === 0) {
      console.log(`[Debug] Reminder ${reminder.id} already locked`);
      continue;
    }

    try {
      // Validate repository still exists and is active
      const repo = await prisma.repositories.findUnique({
        where: { id: reminder.repo_id },
      });

      if (!repo || !repo.is_active) {
        console.log(`[Warning] Repository inactive: ${reminder.repo_id}`);
        await prisma.reminders.update({
          where: { id: reminder.id },
          data: {
            status: "dead",
            error: "Repository is inactive or deleted",
            updated_at: new Date(),
          },
        });
        continue;
      }

      // Send the reminder
      await postGitHubComment({
        repo: reminder.repo_id,
        issueNumber: reminder.issue_number,
        message: reminder.message || "🔔 Reminder",
      });

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
            issueNumber: reminder.issue_number,
          },
        },
      });

      console.log(
        `[Metric] reminders.sent=1 repo=${reminder.repo_id} issue=${reminder.issue_number}`
      );
      
    } catch (err) {
      const nextRetry = reminder.retry_count + 1;
      const isPermanentError = err.message.includes("PERMANENT");
      const isDead = nextRetry >= 5 || isPermanentError;

      const delayMinutes = getNextRetryDelay(nextRetry);
      const nextScheduledAt = isDead 
        ? null 
        : new Date(Date.now() + delayMinutes * 60 * 1000);

      await prisma.reminders.update({
        where: { id: reminder.id },
        data: {
          status: isDead ? "dead" : "failed",
          retry_count: nextRetry,
          error: String(err),
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
            retry: nextRetry,
            error: String(err),
            nextRetryIn: isDead ? null : `${delayMinutes} minutes`,
          },
        },
      });

      console.error(
        `[Error] reminder.${isDead ? "dead" : "failed"} id=${reminder.id} retry=${nextRetry}`,
        err.message
      );
    }
  }

  // Send metrics only once per day (check if already sent today)
  const today = new Date().toISOString().split('T')[0];
  const lastMetricLog = await prisma.audit_logs.findFirst({
    where: {
      action: "DAILY_METRICS_SENT",
      created_at: { gte: new Date(today) },
    },
  });

  if (!lastMetricLog) {
    await sendDailyMetrics();
    await prisma.audit_logs.create({
      data: {
        action: "DAILY_METRICS_SENT",
        meta: { date: today },
      },
    });
  }
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