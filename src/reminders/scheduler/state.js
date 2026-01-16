/**
 * scheduler/state.js
 *
 * Purpose: Centralized state management for the scheduler
 * Manages application state, health status, and circuit breakers
 */

/* -------------------- Global State -------------------- */
export const state = {
  isShuttingDown: false,
  currentProcessingCount: 0,

  healthCheck: {
    status: "starting",
    lastRun: null,
    lastSuccess: null,
    consecutiveFailures: 0,
    processedTotal: 0,
  },

  circuitBreakers: {
    github: { failures: 0, lastFailure: null, isOpen: false },
    telegram: { failures: 0, lastFailure: null, isOpen: false },
  },

  tokenCache: new Map(),
};

/* -------------------- State Helpers -------------------- */
export function resetCircuitBreaker(service) {
  state.circuitBreakers[service] = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
  };
}

export function incrementProcessing() {
  state.currentProcessingCount++;
}

export function decrementProcessing() {
  state.currentProcessingCount--;
}

export function updateHealthCheck(updates) {
  Object.assign(state.healthCheck, updates);
}

/* -------------------- Health Status Export -------------------- */
export function getHealthStatus() {
  return {
    ...state.healthCheck,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    circuitBreakers: {
      github: state.circuitBreakers.github.isOpen ? "open" : "closed",
      telegram: state.circuitBreakers.telegram.isOpen ? "open" : "closed",
    },
    activeProcessing: state.currentProcessingCount,
  };
}
