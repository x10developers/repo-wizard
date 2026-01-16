/**
 * scheduler/metrics.js
 *
 * Purpose: Daily metrics collection and reporting
 * Aggregates reminder statistics and sends notifications
 */

import { prisma } from "../../lib/prisma.js";
import { notifyTelegram, notifyEmail } from "./notifications.js";

/* -------------------- Send Daily Metrics -------------------- */
export async function sendDailyMetricsIfNeeded() {
  const today = new Date().toISOString().split("T")[0];

  const lastMetricLog = await prisma.audit_logs.findFirst({
    where: {
      action: "DAILY_METRICS_SENT",
      created_at: { gte: new Date(today) },
    },
  });

  if (lastMetricLog) return;

  const metrics = await collectDailyMetrics();
  await sendMetricsSummary(metrics);

  await prisma.audit_logs.create({
    data: {
      action: "DAILY_METRICS_SENT",
      meta: { date: today, ...metrics },
    },
  });
}

/* -------------------- Collect Daily Metrics -------------------- */
async function collectDailyMetrics() {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const [sent, failed, dead, pending] = await Promise.all([
    prisma.reminders.count({
      where: { status: "sent", sent_at: { gte: start } },
    }),
    prisma.reminders.count({
      where: { status: "failed", updated_at: { gte: start } },
    }),
    prisma.reminders.count({
      where: { status: "dead", updated_at: { gte: start } },
    }),
    prisma.reminders.count({
      where: { status: "pending" },
    }),
  ]);

  return { sent, failed, dead, pending };
}

/* -------------------- Send Metrics Summary -------------------- */
async function sendMetricsSummary({ sent, failed, dead, pending }) {
  const summary =
    `📊 *RepoReply Daily Metrics*\n\n` +
    `✅ Sent: ${sent}\n` +
    `⚠️ Failed: ${failed}\n` +
    `☠️ Dead: ${dead}\n` +
    `⏳ Pending: ${pending}`;

  await notifyTelegram(summary);
  await notifyEmail(summary);
}
