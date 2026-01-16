/**
 * scheduler/retry.js
 *
 * Purpose: Retry logic with exponential backoff
 * Determines retry delays and dead-letter queue criteria
 */

import { CONFIG } from "./config.js";

/* -------------------- Calculate Retry Delay -------------------- */
export function getNextRetryDelay(retryCount) {
  const delays = CONFIG.RETRY_DELAYS_MIN;
  return delays[Math.min(retryCount, delays.length - 1)];
}

/* -------------------- Dead Letter Queue Check -------------------- */
export function shouldMarkAsDead(retryCount, isPermanentError) {
  return (
    (retryCount >= 3 && isPermanentError) || retryCount >= CONFIG.MAX_RETRIES
  );
}

/* -------------------- Calculate Next Scheduled Time -------------------- */
export function calculateNextScheduledAt(retryCount, isDead) {
  if (isDead) return null;
  const delayMinutes = getNextRetryDelay(retryCount);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}
