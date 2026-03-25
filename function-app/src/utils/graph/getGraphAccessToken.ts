import { extractErrorCode } from "../errors";

export const DEFAULT_GRAPH_SCOPE = "https://graph.microsoft.com/.default";

export type GraphAccessTokenConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
};

type TokenResponseBody = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

function normalizeRequiredSetting(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Read Microsoft Graph token settings from environment variables.
 *
 * Returns `undefined` when no Graph settings are configured, so the template
 * can stay usable without Graph enabled. Throws when the config is partially
 * provided because that almost always indicates a setup mistake.
 */
export function readGraphAccessTokenConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GraphAccessTokenConfig | undefined {
  const tenantId = normalizeRequiredSetting(env.GRAPH_TENANT_ID);
  const clientId = normalizeRequiredSetting(env.GRAPH_CLIENT_ID);
  const clientSecret = normalizeRequiredSetting(env.GRAPH_CLIENT_SECRET);
  const scope = env.GRAPH_SCOPE?.trim() || DEFAULT_GRAPH_SCOPE;

  const configuredValues = [tenantId, clientId, clientSecret].filter(Boolean).length;

  if (configuredValues === 0) {
    return undefined;
  }

  if (configuredValues !== 3) {
    throw new Error(
      "Incomplete Microsoft Graph configuration. Expected GRAPH_TENANT_ID, GRAPH_CLIENT_ID, and GRAPH_CLIENT_SECRET when enabling Graph support.",
    );
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    scope,
  };
}

async function parseTokenResponse(
  response: Response,
): Promise<TokenResponseBody> {
  try {
    return (await response.json()) as TokenResponseBody;
  } catch {
    const bodyText = await response.text();

    return {
      error_description: bodyText,
    };
  }
}

/**
 * Request an app-only Microsoft Graph access token with client credentials.
 */
export async function getGraphAccessToken(
  config: GraphAccessTokenConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const scope = config.scope?.trim() || DEFAULT_GRAPH_SCOPE;
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
    const response = await fetchImpl(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenForm.toString(),
    });
    const responseBody = await parseTokenResponse(response);

    if (!response.ok) {
      const errorCode = responseBody.error ?? "unknown_token_error";
      const errorDescription =
        responseBody.error_description ?? "No response body returned.";

      throw new Error(
        `Graph token request failed (${response.status}) ${errorCode} ${errorDescription}`.trim(),
      );
    }

    if (!responseBody.access_token) {
      throw new Error("Graph token request succeeded but no access token was returned.");
    }

    return responseBody.access_token;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("Graph token request failed")) {
      throw error;
    }

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
