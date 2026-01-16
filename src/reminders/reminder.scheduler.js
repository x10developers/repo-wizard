/**
 * reminder.scheduler.js
 *
 * Purpose: Main scheduler entry point
 * Orchestrates the reminder processing workflow
 * Polls for due reminders and manages the processing lifecycle
 */

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { CONFIG } from "./scheduler/config.js";
import {
  state,
  updateHealthCheck,
  getHealthStatus,
} from "./scheduler/state.js";
import { processReminder } from "./scheduler/processor.js";
import { cleanupStaleLocks } from "./scheduler/cleanup.js";
import { sendDailyMetricsIfNeeded } from "./scheduler/metrics.js";
import { gracefulShutdown } from "./scheduler/shutdown.js";

/* -------------------- Main Scheduler Loop -------------------- */
async function runScheduler() {
  if (state.isShuttingDown) {
    console.log("[Scheduler] Shutdown in progress, skipping run");
    return;
  }

  updateHealthCheck({ lastRun: new Date() });

  try {
    console.log("[Scheduler] Starting run");

    /* -------------------- Clean Stale Locks -------------------- */
    // Clean stale locks
    await cleanupStaleLocks();

    /* -------------------- Fetch Due Reminders -------------------- */
    // Get due reminders
    const now = new Date();
    const dueReminders = await prisma.reminders.findMany({
      where: {
        status: "pending",
        sent_at: null,
        scheduled_at: { lte: now },
        retry_count: { lt: CONFIG.MAX_RETRIES },
      },
      orderBy: { scheduled_at: "asc" },
      take: CONFIG.BATCH_SIZE,
    });

    if (dueReminders.length > 0) {
      console.log(`[Scheduler] Found ${dueReminders.length} due reminders`);
    }

    /* -------------------- Process Each Reminder -------------------- */
    // Process reminders
    for (const reminder of dueReminders) {
      if (state.isShuttingDown) break;
      await processReminder(reminder, now);
    }

    /* -------------------- Send Daily Metrics -------------------- */
    // Send daily metrics
    await sendDailyMetricsIfNeeded();

    /* -------------------- Update Health Status -------------------- */
    // Update health status
    updateHealthCheck({
      status: "healthy",
      lastSuccess: new Date(),
      consecutiveFailures: 0,
      processedTotal: state.healthCheck.processedTotal + dueReminders.length,
    });
  } catch (err) {
    /* -------------------- Error Handling -------------------- */
    const failures = state.healthCheck.consecutiveFailures + 1;
    updateHealthCheck({
      consecutiveFailures: failures,
      status: failures > 3 ? "unhealthy" : "degraded",
    });
    console.error("[Scheduler] Run failed:", err);
  }
}

/* -------------------- Startup & Process Handlers -------------------- */
console.log("[Scheduler] Starting reminder scheduler (Production Mode)");

/* -------------------- Shutdown Handlers -------------------- */
// Shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

/* -------------------- Error Handlers -------------------- */
// Error handlers
process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught exception:", err);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Fatal] Unhandled rejection:", promise, reason);
});

/* -------------------- Initial Run -------------------- */
// Initial run
setTimeout(() => {
  runScheduler().catch((err) => {
    console.error("[Scheduler] Initial run failed:", err);
  });
}, CONFIG.STARTUP_DELAY_MS);

/* -------------------- Continuous Polling -------------------- */
// Continuous polling
const intervalId = setInterval(() => {
  if (!state.isShuttingDown) {
    runScheduler().catch((err) => {
      console.error("[Scheduler] Interval run failed:", err);
    });
  }
}, CONFIG.POLL_INTERVAL_MS);

/* -------------------- Cleanup on Exit -------------------- */
// Cleanup on exit
process.on("exit", () => clearInterval(intervalId));

/* -------------------- Health Check Export -------------------- */
// Export health check for monitoring
export { getHealthStatus };
