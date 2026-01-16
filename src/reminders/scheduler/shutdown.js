/**
 * scheduler/shutdown.js
 *
 * Purpose: Graceful shutdown handling
 * Ensures clean shutdown with in-flight request completion
 */

import { prisma } from "../../lib/prisma.js";
import { state } from "./state.js";

/* -------------------- Graceful Shutdown Handler -------------------- */
export async function gracefulShutdown(signal) {
  console.log(`[Shutdown] Received ${signal}, starting graceful shutdown`);
  state.isShuttingDown = true;

  /* -------------------- Wait for In-Flight Operations -------------------- */
  // Wait for current processing to complete (max 30 seconds)
  const startTime = Date.now();
  const maxWaitTime = 30000;

  while (
    state.currentProcessingCount > 0 &&
    Date.now() - startTime < maxWaitTime
  ) {
    console.log(
      `[Shutdown] Waiting for ${state.currentProcessingCount} reminders...`
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (state.currentProcessingCount > 0) {
    console.warn(
      `[Shutdown] Forced shutdown with ${state.currentProcessingCount} reminders processing`
    );
  }

  /* -------------------- Database Cleanup -------------------- */
  // Disconnect from database
  await prisma.$disconnect();

  console.log("[Shutdown] Cleanup complete, exiting");
  process.exit(0);
}
