/**
 * Minimal result contract for operations that can retry on DNS failures.
 */
export type DnsRetryableResult = {
  isError: boolean;
  errorCode?: string;
};

/**
 * Options for DNS-only retry behavior.
 */
export type RetryOnDnsOptions<TResult extends DnsRetryableResult> = {
  maxAttempts?: number;
  retryDelayMs?: number;
  onRetry?: (args: {
    attempt: number;
    nextAttempt: number;
    waitMs: number;
    result: TResult;
  }) => void;
};

/**
 * Final outcome returned by `retryOnDns`, including the last attempt count.
 */
export type RetryOnDnsResult<TResult extends DnsRetryableResult> = {
  attempts: number;
  result: TResult;
};

/**
 * Default number of attempts used by `retryOnDns`.
 */
export const DEFAULT_MAX_DNS_ATTEMPTS = 4;
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

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Retries an operation only for DNS resolution failures and otherwise returns
 * the first non-retryable outcome immediately.
 */
export async function retryOnDns<TArgs, TResult extends DnsRetryableResult>(
  fn: (args: TArgs) => Promise<TResult>,
  args: TArgs,
  options: RetryOnDnsOptions<TResult> = {},
): Promise<RetryOnDnsResult<TResult>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_DNS_ATTEMPTS);
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_DNS_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fn(args);
    const isLastAttempt = attempt === maxAttempts;

    // Keep this helper intentionally narrow: only transport-level DNS failures
    // are retried here, while HTTP/application errors should fail fast.
    if (!result.isError || !isRetryableDnsErrorCode(result.errorCode) || isLastAttempt) {
      return { attempts: attempt, result };
    }

    options.onRetry?.({
      attempt,
      nextAttempt: attempt + 1,
      waitMs: retryDelayMs,
      result,
    });
    await wait(retryDelayMs);
  }

  throw new Error("retryOnDns exited without returning a result.");
}
