/**
 * scheduler/circuit-breaker.js
 *
 * Purpose: Circuit breaker pattern implementation
 * Prevents cascading failures by opening circuit after threshold failures
 */

import { CONFIG } from "./config.js";
import { state } from "./state.js";

/* -------------------- Circuit Breaker Check -------------------- */
export function checkCircuitBreaker(service) {
  const breaker = state.circuitBreakers[service];

  if (!breaker.isOpen) return;

  const timeSinceLastFailure = Date.now() - breaker.lastFailure;

  if (timeSinceLastFailure < CONFIG.CIRCUIT_BREAKER_TIMEOUT_MS) {
    throw new Error(`PERMANENT: ${service} circuit breaker is open`);
  }

  // Reset circuit breaker after timeout
  breaker.isOpen = false;
  breaker.failures = 0;
  console.log(`[CircuitBreaker] ${service} circuit breaker reset`);
}

/* -------------------- Success Handler -------------------- */
export function recordSuccess(service) {
  state.circuitBreakers[service].failures = 0;
}

/* -------------------- Failure Handler -------------------- */
export function recordFailure(service) {
  const breaker = state.circuitBreakers[service];
  breaker.failures++;
  breaker.lastFailure = Date.now();

  if (breaker.failures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
    breaker.isOpen = true;
    console.error(`[CircuitBreaker] ${service} circuit breaker OPENED`);
  }
}
