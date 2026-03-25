# 08 - Optional Microsoft Graph Setup

## Purpose

This template does not use Microsoft Graph by default.

Add this setup only when your new project needs Graph-backed features such as:

- SharePoint list reads
- Microsoft 365 data access
- app-only mailbox sending

Treat this as an extension guide after the base `Hello World` template is already working.

## What You Need to Add to the Template

The current starter does not yet include:

- Key Vault for secret storage
- managed identity for secret resolution
- a live Graph-integrated function endpoint

Before wiring Graph, plan to update:

1. `infra/main.bicep`
2. `infra/main.parameters.dev.json`
3. `infra/main.parameters.prod.json`
4. `function-app/local.settings.json`
5. your function code under `function-app/src/functions/`

The template now already includes:

- optional Graph app settings in the Function App infrastructure
- a reusable token helper in `function-app/src/utils/graph/getGraphAccessToken.ts`
- environment-based Graph config loading

## Recommended Identity Split

Keep these identities separate:

1. Deployment app registration for GitHub to Azure OIDC
2. Runtime Graph app registration for the Function App
3. Optional admin-grant app or admin user context for privileged Graph setup operations

Do not reuse the deployer app as the runtime Graph app.

## Create the Runtime Graph App

Create one runtime app per environment if you want clean separation:

- `app-<client>-graph-dev`
- `app-<client>-graph-prod`

Typical Graph application permissions:

- `Sites.Selected` for SharePoint site-scoped access
- `Mail.Send` if the app must send mail

Grant admin consent after adding application permissions.

## Resolve SharePoint Site and List IDs

Use a team site, not a personal OneDrive-style site.

Example site URL:

- `https://<tenant>.sharepoint.com/sites/<site-name>`

Get a Graph access token:

```bash
TOKEN=$(az account get-access-token --resource-type ms-graph --query accessToken -o tsv)
```

Resolve the site:

```bash
curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  "https://graph.microsoft.com/v1.0/sites/<tenant>.sharepoint.com:/sites/<site-name>?\$select=id,webUrl,displayName"
```

List available lists:

```bash
SITE_ID='<site-id>'
curl -sS -G \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "\$select=id,displayName" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists" | jq .
```

## Grant Site Access to the Runtime App

For `Sites.Selected`, the app also needs an explicit site grant.
The grant is applied at site scope, not list scope.

Set:

```bash
SITE_ID='<site-id>'
TARGET_APP_ID='<graph-runtime-client-id>'
TARGET_APP_NAME='app-<client>-graph-prod'
ADMIN_TOKEN=$(az account get-access-token --resource-type ms-graph --query accessToken -o tsv)
```

Create the grant:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions" \
  -d "{
    \"roles\": [\"write\"],
    \"grantedToIdentities\": [
      {
        \"application\": {
          \"id\": \"${TARGET_APP_ID}\",
          \"displayName\": \"${TARGET_APP_NAME}\"
        }
      }
    ]
  }" | jq .
```

Verify:

```bash
curl -sS \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions" | jq .
```

Focused verification:

```bash
curl -sS \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions" \
  | jq --arg APPID "$TARGET_APP_ID" '.value[] | select(.grantedToIdentitiesV2[0].application.id == $APPID) | {id,roles,app:.grantedToIdentitiesV2[0].application}'
```

## If `POST /sites/{siteId}/permissions` Returns `accessDenied`

Your current token does not have enough Graph privilege to grant site access.

Use a dedicated admin-grant app with a high-privilege Graph application permission such as `Sites.FullControl.All` to perform the grant operation:

```bash
TENANT_ID='<tenant-id>'
ADMIN_GRANT_APP_ID='<admin-grant-app-id>'
ADMIN_GRANT_APP_SECRET='<admin-grant-app-secret>'

ADMIN_TOKEN=$(curl -sS -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${ADMIN_GRANT_APP_ID}" \
  -d "client_secret=${ADMIN_GRANT_APP_SECRET}" \
  -d "scope=https%3A%2F%2Fgraph.microsoft.com%2F.default" \
  -d "grant_type=client_credentials" | jq -r .access_token)
```

## Validate Runtime App Access

Request a token with the runtime app:

```bash
GRAPH_TENANT_ID='<tenant-id>'
GRAPH_CLIENT_ID='<runtime-app-client-id>'
GRAPH_CLIENT_SECRET='<runtime-app-secret-value>'

TOKEN_JSON=$(curl -s -X POST "https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${GRAPH_CLIENT_ID}" \
  -d "client_secret=${GRAPH_CLIENT_SECRET}" \
  -d "scope=https%3A%2F%2Fgraph.microsoft.com%2F.default" \
  -d "grant_type=client_credentials")

APP_TOKEN=$(echo "$TOKEN_JSON" | jq -r .access_token)
```

Test a SharePoint list read:

```bash
curl -sS -G \
  -H "Authorization: Bearer ${APP_TOKEN}" \
  --data-urlencode "\$top=3" \
  --data-urlencode "\$expand=fields" \
  "https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/<list-id>/items" | jq .
```

## Add Runtime Settings to the Template

The base template already includes these optional settings:

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_SCOPE`

For local development, mirror the same names in `function-app/local.settings.json`.

Add project-specific settings such as these only when your derived project needs them:

- `SHAREPOINT_SITE_ID`
- `SHAREPOINT_LIST_ID`
- sender mailbox settings
- feature-specific Graph endpoints or IDs

## Secret Storage Recommendation

Do not leave production Graph secrets in plain app settings.

Recommended path:

1. add Key Vault back into the infrastructure
2. store the Graph client secret in Key Vault
3. use a managed identity or Key Vault reference pattern for the Function App

The earlier invoice-tracker version of this repo used that pattern successfully.

## Optional Mail Sending

If the Function App must send email through Graph, add Graph application permission:

- `Mail.Send`

Grant admin consent after adding it.

For app-only sending:

- use `POST /v1.0/users/{senderMailbox}/sendMail`
- do not use `/me/sendMail`

## Exchange App RBAC for Mail Scope

For production tenants, consider Exchange Application RBAC so the app can only send as approved mailboxes.

High-level pattern:

1. map the Entra app into Exchange
2. create a security group for allowed mailbox scope
3. create a management scope for that group
4. assign the `Application Mail.Send` role to the app and scope
5. validate with `Test-ServicePrincipalAuthorization`

This is optional for the template, but recommended when the Graph app can send mail.

## Utility Code Included in This Template

The starter now includes:

- `function-app/src/utils/graph/getGraphAccessToken.ts`
- `function-app/src/utils/errors.ts`

Use `readGraphAccessTokenConfigFromEnv()` when a function should support Graph only when the environment is configured.
That helper returns `undefined` when Graph is not configured at all, and throws when the Graph config is only partially populated.

## Recommended Documentation Pattern for Derived Projects

If a project adds Graph support, update:

1. `README.md`
2. `docs/04-customize-template.md`
3. `docs/06-troubleshooting.md`
4. environment parameter file comments
5. local setup instructions

Make it explicit which Graph permissions, site grants, and secret storage patterns the project requires.
