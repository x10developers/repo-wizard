/**
 * scheduler/config.js
 *
 * Purpose: Centralized configuration for the reminder scheduler
 * Contains all constants, timeouts, and tunable parameters
 */

/* -------------------- Configuration Constants -------------------- */
export const CONFIG = {
  BATCH_SIZE: 50,
  POLL_INTERVAL_MS: 30 * 1000,
  STARTUP_DELAY_MS: 5000,
  MAX_RETRIES: 5,
  RETRY_DELAYS_MIN: [5, 15, 30, 60, 120],
  PROCESSING_TIMEOUT_MS: 5 * 60 * 1000,
  GITHUB_RATE_LIMIT_BUFFER: 100,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_TIMEOUT_MS: 60 * 1000,
  TOKEN_CACHE_DURATION_MS: 50 * 60 * 1000,
};
