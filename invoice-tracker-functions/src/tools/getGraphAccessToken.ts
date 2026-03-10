/**
 * Utilities for acquiring a Microsoft Graph app-only access token.
 */

/**
 * Default scope used when the caller does not provide an explicit Graph scope.
 */
const DEFAULT_GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/**
 * Settings required to request an app-only Microsoft Graph access token.
 */
export type GraphAccessTokenConfig = {
  /**
   * Microsoft Entra tenant ID used for the token request.
   */
  tenantId: string;
  /**
   * Client ID of the app registration requesting the token.
   */
  clientId: string;
  /**
   * Client secret for the app registration requesting the token.
   */
  clientSecret: string;
  /**
   * Optional Graph scope override for the token request.
   */
  scope?: string;
};

/**
 * Requests an app-only access token for Microsoft Graph by using the client
 * credentials flow.
 *
 * @param config The tenant, client, secret, and optional scope used for the client credentials token request.
 * @returns A promise that resolves to a bearer token for calling Microsoft Graph.
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

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenForm.toString(),
  });

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    const errorCode = tokenPayload.error ?? "unknown_token_error";
    const errorDescription = tokenPayload.error_description ?? "";
    throw new Error(
      `Graph token request failed (${tokenResponse.status}) ${errorCode} ${errorDescription}`.trim(),
    );
  }

  return tokenPayload.access_token;
}
