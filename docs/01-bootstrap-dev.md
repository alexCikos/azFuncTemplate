# 01 - Bootstrap Dev Environment

## Purpose

Use this when you want Azure infrastructure created before the GitHub deployment runs.

## Prerequisites

- Node.js 22
- npm
- Azure CLI
- Azure Functions Core Tools

## Check the Parameter File

Edit `infra/main.parameters.dev.json` before bootstrapping:

- `location`
- `namePrefix`
- `tags`

The default values are intentionally generic so the template works out of the box.

## Bootstrap Command

Run:

```bash
./scripts/bootstrap-environment.sh dev
```

Optional subscription and resource-group overrides:

```bash
./scripts/bootstrap-environment.sh dev <subscription-id> <resource-group>
```

## What the Script Does

1. Verifies Azure CLI access
2. Creates the resource group if needed
3. Deploys `infra/main.bicep`
4. Prints the Function App host name
5. Prints the GitHub environment variables you need next

## Next Step

Continue with:

- [02 - GitHub OIDC Deployment](./02-github-oidc-deploy.md)
