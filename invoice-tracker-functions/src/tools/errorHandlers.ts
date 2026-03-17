/**
 * Default delay between DNS retry attempts, in milliseconds.
 */
export const DEFAULT_DNS_RETRY_DELAY_MS = 10_000;

const RETRYABLE_DNS_ERROR_CODES = new Set(["EAI_AGAIN", "ENOTFOUND"]);

/**
 * Extracts a low-level machine-readable error code from a thrown value when one
 * is available, including Node `fetch` errors exposed via `cause.code`.
 */
export function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("cause" in error) {
    const cause = error.cause;
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      typeof cause.code === "string"
    ) {
      return cause.code;
    }
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  return undefined;
}

/**
 * Returns `true` when the provided error code represents a retryable DNS
 * resolution failure.
 */
export function isRetryableDnsErrorCode(
  errorCode: string | undefined,
): boolean {
  return typeof errorCode === "string" && RETRYABLE_DNS_ERROR_CODES.has(errorCode);
}
