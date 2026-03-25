/**
 * Extract a low-level machine-readable error code when one is available.
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
