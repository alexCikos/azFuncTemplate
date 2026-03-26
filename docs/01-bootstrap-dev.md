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

Recommended review order:

1. choose a workload-specific `namePrefix`
2. confirm the Azure region
3. decide whether Graph settings stay blank for now
4. confirm tags such as `application`, `owner`, and `purpose`
5. confirm the Azure subscription ID
6. confirm whether to use the default resource-group name `rg-<namePrefix>-dev`

If an answer can be learned from the workspace, inspect the repo first instead of asking the user.
Ask one concise question at a time, give a recommended answer, then update the parameter file only after the values are settled.

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
