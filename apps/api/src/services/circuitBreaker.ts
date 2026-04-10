import type { Logger } from '../config/logger';
import { CIRCUIT_BREAKER_THRESHOLD, CIRCUIT_BREAKER_TIMEOUT_MS } from '../config/constants';

type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Simple in-process circuit breaker for external service calls.
 *
 * States:
 *   closed  — normal operation, calls pass through
 *   open    — too many failures, calls are skipped for CIRCUIT_BREAKER_TIMEOUT_MS (60s)
 *   half-open — one trial call after the timeout; success → closed, failure → open
 *
 * Failure counts are in-process memory. A deploy resets them (acceptable for pilot).
 * This prevents cascading timeouts when a third-party service (Resend, Twilio, FCM) is down.
 */
export function createCircuitBreaker(name: string, logger: Logger) {
  let state: BreakerState = 'closed';
  let failureCount = 0;
  let openedAt = 0;

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T | void> {
      const now = Date.now();

      if (state === 'open') {
        if (now - openedAt >= CIRCUIT_BREAKER_TIMEOUT_MS) {
          // Transition to half-open: allow one trial call.
          state = 'half-open';
          logger.warn({ service: name }, '[CircuitBreaker] Entering half-open state');
        } else {
          logger.warn({ service: name }, '[CircuitBreaker] Circuit open — skipping call');
          return;
        }
      }

      try {
        const result = await fn();
        // Success: reset.
        if (state !== 'closed') {
          logger.info({ service: name }, '[CircuitBreaker] Closing circuit after successful call');
        }
        state = 'closed';
        failureCount = 0;
        return result;
      } catch (err) {
        failureCount++;
        logger.warn({ service: name, failureCount, err }, '[CircuitBreaker] External service failure');

        if (failureCount >= CIRCUIT_BREAKER_THRESHOLD || state === 'half-open') {
          state = 'open';
          openedAt = Date.now();
          logger.error(
            { service: name },
            `[CircuitBreaker] Opening circuit after ${failureCount} consecutive failures`,
          );
        }
        throw err;
      }
    },
  };
}
