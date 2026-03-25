const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_GRAPH_SCOPE,
  getGraphAccessToken,
  readGraphAccessTokenConfigFromEnv,
} = require("../dist/src/utils/graph/getGraphAccessToken.js");

test("readGraphAccessTokenConfigFromEnv returns undefined when Graph is not configured", () => {
  assert.equal(readGraphAccessTokenConfigFromEnv({}), undefined);
});

test("readGraphAccessTokenConfigFromEnv returns normalized config when fully configured", () => {
  const config = readGraphAccessTokenConfigFromEnv({
    GRAPH_TENANT_ID: " tenant-id ",
    GRAPH_CLIENT_ID: " client-id ",
    GRAPH_CLIENT_SECRET: " secret ",
    GRAPH_SCOPE: " custom-scope ",
  });

  assert.deepEqual(config, {
    tenantId: "tenant-id",
    clientId: "client-id",
    clientSecret: "secret",
    scope: "custom-scope",
  });
});

test("readGraphAccessTokenConfigFromEnv falls back to the default scope", () => {
  const config = readGraphAccessTokenConfigFromEnv({
    GRAPH_TENANT_ID: "tenant-id",
    GRAPH_CLIENT_ID: "client-id",
    GRAPH_CLIENT_SECRET: "secret",
  });

  assert.equal(config.scope, DEFAULT_GRAPH_SCOPE);
});

test("readGraphAccessTokenConfigFromEnv throws on partial config", () => {
  assert.throws(
    () =>
      readGraphAccessTokenConfigFromEnv({
        GRAPH_TENANT_ID: "tenant-id",
        GRAPH_CLIENT_ID: "client-id",
      }),
    /Incomplete Microsoft Graph configuration/,
  );
});

test("getGraphAccessToken returns the access token from a successful response", async () => {
  const token = await getGraphAccessToken(
    {
      tenantId: "tenant-id",
      clientId: "client-id",
      clientSecret: "secret",
    },
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "token-value" }),
      text: async () => "",
    }),
  );

  assert.equal(token, "token-value");
});

test("getGraphAccessToken surfaces Graph OAuth errors", async () => {
  await assert.rejects(
    () =>
      getGraphAccessToken(
        {
          tenantId: "tenant-id",
          clientId: "client-id",
          clientSecret: "secret",
        },
        async () => ({
          ok: false,
          status: 401,
          json: async () => ({
            error: "invalid_client",
            error_description: "Bad client secret",
          }),
          text: async () => "",
        }),
      ),
    /Graph token request failed \(401\) invalid_client Bad client secret/,
  );
});
