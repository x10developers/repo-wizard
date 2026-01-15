/**
 * File: reminder.scheduler.js (TIMEZONE FIXED VERSION)
 *
 * Fixes:
 * - ✅ Proper UTC timezone handling throughout
 * - ✅ GitHub App authentication with file-based private key
 * - ✅ Fixed installation_id retrieval from database
 * - ✅ Fixed BigInt serialization in audit logs
 * - ✅ Better error handling and logging
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { Octokit } from "@octokit/rest";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

/* --------------------------------------------- */
/* GitHub App Authentication                     */
/* --------------------------------------------- */
async function getGitHubClient(repoFullName) {
  // Get installation_id from database FIRST
  const repo = await prisma.repositories.findUnique({
    where: { id: repoFullName },
    select: { installation_id: true },
  });

  console.log(`[Scheduler] Repo lookup:`, {
    repo: repoFullName,
    installation_id: repo?.installation_id
      ? repo.installation_id.toString()
      : "null",
  });

  if (!repo?.installation_id) {
    throw new Error(
      `PERMANENT: No installation_id for repository ${repoFullName}`
    );
  }

  // Read private key from file
  let privateKey;

  if (process.env.GITHUB_PRIVATE_KEY_PATH) {
    const keyPath = path.resolve(
      process.cwd(),
      process.env.GITHUB_PRIVATE_KEY_PATH
    );
    console.log(`[Scheduler] Reading private key from: ${keyPath}`);
    privateKey = fs.readFileSync(keyPath, "utf8");
    console.log("[Scheduler] ✅ Private key loaded from file");
  } else if (process.env.GITHUB_PRIVATE_KEY) {
    privateKey = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
    console.log("[Scheduler] ✅ Private key loaded from env var");
  } else {
    throw new Error(
      "PERMANENT: No GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH found"
    );
  }

  // Generate JWT for GitHub App
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 600, // 10 minutes
    iss: process.env.GITHUB_APP_ID,
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
  });

  // Get installation token
  const appOctokit = new Octokit({ auth: token });

  // Convert BigInt to Number for API call
  const installationId = Number(repo.installation_id);

  const { data: installation } =
    await appOctokit.apps.createInstallationAccessToken({
      installation_id: installationId,
    });

  console.log(`[Scheduler] ✅ Got installation token for ${repoFullName}`);

  return new Octokit({ auth: installation.token });
}

/* --------------------------------------------- */
/* GitHub delivery                               */
/* --------------------------------------------- */
async function postGitHubComment({ repo, issueNumber, message }) {
  try {
    const octokit = await getGitHubClient(repo);
    const [owner, repoName] = repo.split("/");

    await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: issueNumber,
      body: message,
    });

    return { success: true };
  } catch (err) {
    // Check if it's a permanent error
    if (err.status === 404 || err.status === 410) {
      throw new Error(`PERMANENT: Issue not found or deleted (${err.status})`);
    }

    if (err.status === 401 || err.status === 403) {
      throw new Error(`PERMANENT: Authentication failed (${err.status})`);
    }

    throw err;
  }
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
  // Get current UTC date boundaries
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(now);
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

  // CRITICAL: Get current UTC time
  const now = new Date();

  // Log timezone info for debugging
  console.log(`[Scheduler] Current time check:`, {
    utc: now.toISOString(),
    timestamp: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const dueReminders = await prisma.reminders.findMany({
    where: {
      status: "pending",
      sent_at: null,
      scheduled_at: { lte: now }, // Compare UTC to UTC
      retry_count: { lt: 5 },
    },
    orderBy: { scheduled_at: "asc" },
    take: 50, // Process in batches
  });

  console.log(`[Metric] reminders.checked=${dueReminders.length}`);

  // Log details of found reminders
  if (dueReminders.length > 0) {
    console.log(`[Scheduler] Found ${dueReminders.length} due reminders:`);
    dueReminders.forEach((r) => {
      console.log(
        `  - ID: ${
          r.id
        }, Scheduled: ${r.scheduled_at.toISOString()}, Now: ${now.toISOString()}, Due: ${
          r.scheduled_at <= now
        }`
      );
    });
  } else {
    // Check if there are any pending reminders at all
    const totalPending = await prisma.reminders.count({
      where: { status: "pending" },
    });
    console.log(
      `[Scheduler] No due reminders found. Total pending: ${totalPending}`
    );

    if (totalPending > 0) {
      // Show the next upcoming reminder
      const nextReminder = await prisma.reminders.findFirst({
        where: { status: "pending" },
        orderBy: { scheduled_at: "asc" },
      });
      if (nextReminder) {
        const timeUntil = Math.round(
          (nextReminder.scheduled_at.getTime() - now.getTime()) / 1000 / 60
        );
        console.log(
          `[Scheduler] Next reminder due in ${timeUntil} minutes (${nextReminder.scheduled_at.toISOString()})`
        );
      }
    }
  }

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
          sent_at: new Date(), // Store current UTC time
          updated_at: new Date(),
        },
      });

      // FIX: Convert all values to safe JSON types
      await prisma.audit_logs.create({
        data: {
          repo_id: reminder.repo_id,
          action: "REMINDER_SENT",
          meta: {
            reminderId: reminder.id,
            issueNumber: Number(reminder.issue_number), // Ensure it's a number
          },
        },
      });

      console.log(
        `[Metric] reminders.sent=1 repo=${reminder.repo_id} issue=${reminder.issue_number}`
      );
    } catch (err) {
      const nextRetry = reminder.retry_count + 1;
      const isPermanentError = err.message && err.message.includes("PERMANENT");
      const isDead = (nextRetry >= 3 && isPermanentError) || nextRetry >= 5;

      const delayMinutes = getNextRetryDelay(nextRetry);
      const nextScheduledAt = isDead
        ? null
        : new Date(Date.now() + delayMinutes * 60 * 1000);

      await prisma.reminders.update({
        where: { id: reminder.id },
        data: {
          status: isDead ? "dead" : "failed",
          retry_count: nextRetry,
          error: String(err).substring(0, 500), // Limit error length
          scheduled_at: nextScheduledAt || reminder.scheduled_at,
          last_retry_at: new Date(),
          updated_at: new Date(),
        },
      });

      // FIX: Ensure all meta values are JSON-safe (no BigInt)
      await prisma.audit_logs.create({
        data: {
          repo_id: reminder.repo_id,
          action: isDead ? "REMINDER_DEAD" : "REMINDER_FAILED",
          meta: {
            reminderId: reminder.id,
            retry: Number(nextRetry), // Ensure it's a number
            error: String(err).substring(0, 500), // Limit error length
            nextRetryIn: isDead ? null : `${delayMinutes} minutes`,
          },
        },
      });

      console.error(
        `[Error] reminder.${isDead ? "dead" : "failed"} id=${
          reminder.id
        } retry=${nextRetry}`,
        err.message
      );
    }
  }

  // Send metrics only once per day (check if already sent today)
  const today = new Date().toISOString().split("T")[0];
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

// Add startup delay to avoid race conditions
console.log("[Scheduler] Waiting 5 seconds before first run...");

setTimeout(() => {
  runScheduler()
    .catch((err) => {
      console.error("[Fatal] scheduler.crashed", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}, 5000); // Wait 5 seconds
