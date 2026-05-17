import { logger } from "./logger.js";

export async function withRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelayMs * 2 ** attempt;
      logger.warn({ err: error, operationName, attempt }, "operation failed, retrying");
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  throw new Error(`Operation '${operationName}' failed after ${maxRetries + 1} attempts: ${String(lastError)}`);
}
