# 02 - GitHub OIDC Deployment

## Goal

Allow GitHub Actions to deploy to Azure without storing an Azure client secret in the repository.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated, or access to the repository settings UI
- Azure CLI access to the target tenant and subscription

Recommended checks when using GitHub CLI:

```bash
gh auth status
gh auth setup-git
```

## Create a Deployment App Registration

Create an Entra app registration for GitHub deployments. One per environment is the simplest setup:

- `gh-deployer-<workload>-dev`
- `gh-deployer-<workload>-prod`

You can do the Azure-side setup in the Azure UI or with Azure CLI.
When using Codex for active help, prefer Azure CLI so the full deployment setup can stay in chat.

Capture:

- Application (client) ID
- Directory (tenant) ID
- Azure subscription ID

## Template Helper Script

This template includes a helper script that creates or reuses the deployer app registration, service principal, federated credential, and resource-group Contributor assignment:

```bash
./scripts/create-deployer-app.sh dev
```

For production:

```bash
./scripts/create-deployer-app.sh prod
```

The script:

- reads `namePrefix` from the matching parameter file
- derives the default resource-group name from the template convention
- detects the GitHub repo from `remote.origin.url`
- prints the exact GitHub variables and `gh` commands to run next

If the repo remote is not configured yet, pass the repo explicitly:

```bash
./scripts/create-deployer-app.sh dev --repo <owner>/<repo>
```

## Add Federated Credentials

If you use `./scripts/create-deployer-app.sh`, this step is handled for you.

In the app registration, add a federated credential for each GitHub environment and branch you want to trust.

Recommended split:

- `dev` environment for the `dev` branch
- `prod` environment for the `main` branch

Because these workflows deploy with GitHub environments, the trust subject should match this shape:

```text
repo:<owner>/<repo>:environment:<env>
```

Examples:

- `repo:octo-org/hello-template:environment:dev`
- `repo:octo-org/hello-template:environment:prod`

## Manual Azure CLI Flow

If you do not want to use the helper script, this is the equivalent Azure CLI path for `dev`:

```bash
ENV_NAME=dev
REPO_SLUG=<owner>/<repo>
APP_NAME=gh-deployer-<workload>-${ENV_NAME}
SUBSCRIPTION_ID=<subscription-id>
RESOURCE_GROUP=rg-<namePrefix>-${ENV_NAME}

APP_ID=$(az ad app create \
  --display-name "${APP_NAME}" \
  --sign-in-audience AzureADMyOrg \
  --query appId \
  --output tsv)

az ad sp create --id "${APP_ID}"

TENANT_ID=$(az account show --query tenantId --output tsv)
SP_OBJECT_ID=$(az ad sp show --id "${APP_ID}" --query id --output tsv)

az ad app federated-credential create \
  --id "${APP_ID}" \
  --parameters "{
    \"name\": \"github-${ENV_NAME}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${REPO_SLUG}:environment:${ENV_NAME}\",
    \"description\": \"GitHub Actions OIDC for ${REPO_SLUG} (${ENV_NAME})\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

az role assignment create \
  --assignee-object-id "${SP_OBJECT_ID}" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"
```

The same pattern applies to `prod` by changing `ENV_NAME`, the app name, and the resource group.

## Configure GitHub Environment Variables

Create GitHub environments named `dev` and `prod`, then add:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RG`

With GitHub CLI, you can create an environment and set its variables like this:

```bash
ENV_NAME=dev
gh api --method PUT repos/<owner>/<repo>/environments/${ENV_NAME}
gh variable set AZURE_CLIENT_ID --env "${ENV_NAME}" --body <client-id>
gh variable set AZURE_TENANT_ID --env "${ENV_NAME}" --body <tenant-id>
gh variable set AZURE_SUBSCRIPTION_ID --env "${ENV_NAME}" --body <subscription-id>
gh variable set AZURE_RG --env "${ENV_NAME}" --body <resource-group>
```

Verify the environment variables:

```bash
gh variable list --env dev
```

## Enable Deployment After Setup

Leave deployment disabled while the repo is still acting as a template or before Azure is ready.

When the Azure side is configured, create this repository variable:

- `ENABLE_AZURE_DEPLOY=true`

With GitHub CLI:

```bash
gh variable set ENABLE_AZURE_DEPLOY --body true
```

Until that variable exists, pushes to `dev` and `main` will skip the deploy job instead of failing.

Verify the repository variable:

```bash
gh variable list
```

## Recommended CLI Flow

After Azure bootstrap succeeds, a practical chat-friendly setup sequence is:

1. bootstrap the target environment with `./scripts/bootstrap-environment.sh <env>`
2. create or update the deployer app registration with `./scripts/create-deployer-app.sh <env>`
3. verify GitHub CLI auth with `gh auth status` and wire Git pushes with `gh auth setup-git`
4. create the GitHub environment, for example `dev`
5. set `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_RG`
6. set `ENABLE_AZURE_DEPLOY=true`
7. trigger a deployment by pushing to `dev` or manually dispatching the workflow

If `git push` fails with `Invalid username or token` after `gh auth login`, run:

```bash
gh auth setup-git
```

Then retry the push.

## Deployment Workflows

Included workflows:

- `.github/workflows/validate-template.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`

## Branch Protection

Recommended GitHub branch protection:

For `dev`:

- require pull requests before merging
- require the `Validate Template` status check to pass
- optionally require at least one review if multiple people will use the repo

For `main`:

- require pull requests before merging
- require the `Validate Template` status check to pass
- require `dev` validation or a reviewed promotion flow before merging
- restrict direct pushes if this will be used in a team setting

This cannot be enforced from the template code alone.
Each derived repository should enable branch protection in GitHub settings after the repo is created.

## Next Step

Continue with:

- [03 - Promote to Production](./03-promote-to-prod.md)
