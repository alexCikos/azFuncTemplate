import axios from "axios";
import { extractErrorCode } from "./errorHandlers";

const DEFAULT_GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/**
 * Settings required for the Microsoft Graph client-credentials token request.
 */
export type GraphAccessTokenConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
};

/**
 * Requests an app-only Microsoft Graph access token.
 *
 * Throws when Graph rejects the request or when no access token is returned,
 * because token acquisition is a workflow prerequisite rather than an
 * item-level recoverable failure.
 */
export async function getGraphAccessToken(
  config: GraphAccessTokenConfig,
): Promise<string> {
  const scope = config.scope ?? DEFAULT_GRAPH_SCOPE;

  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    config.tenantId,
  )}/oauth2/v2.0/token`;

  const tokenForm = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope,
    grant_type: "client_credentials",
  });

  try {
    const tokenResponse = await axios.post<{
      access_token?: string;
    }>(tokenEndpoint, tokenForm.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!tokenResponse.data.access_token) {
      throw new Error("No access token returned.");
    }

    return tokenResponse.data.access_token;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data as
        | { error?: string; error_description?: string }
        | undefined;

      if (typeof statusCode === "number") {
        const errorCode = responseData?.error ?? "unknown_token_error";
        const errorDescription =
          responseData?.error_description ?? error.message;
        throw new Error(
          `Graph token request failed (${statusCode}) ${errorCode} ${errorDescription}`.trim(),
        );
      }
    }

    // Token acquisition is a whole-workflow dependency, so callers expect a
    // thrown error here instead of a recoverable result object.
    const errorCode = extractErrorCode(error);
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Graph token request error.";
    throw new Error(
      `Graph token request failed${errorCode ? ` (${errorCode})` : ""} ${message}`.trim(),
    );
  }
}
