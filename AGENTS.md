# Repository Guidance

## Purpose

This repository is a reusable Azure Functions template.
The base experience must stay simple:

- local `Hello World` works immediately
- the repo can be pushed before Azure is configured
- Azure deployment is disabled by default until explicitly enabled

## Deployment Rules

- `dev` branch maps to the `dev` Azure environment
- `main` branch maps to the `prod` Azure environment
- deployment workflows must stay safe for fresh template repos
- do not remove the `ENABLE_AZURE_DEPLOY=true` gate unless the user explicitly asks for always-on deployment

## Graph Rules

- Microsoft Graph support is optional, not required for the starter template
- keep `Hello World` as the default runtime path
- optional Graph utilities and app settings may exist, but they must not break the base template when left blank
- when adding or changing Graph patterns, update `docs/08-optional-microsoft-graph-setup.md`

## Docs and Skill Sync

This repo includes a source-controlled setup skill under `skills/azure-function-template-setup/`.

When changing setup flow, deployment flow, or Graph setup:

1. update the relevant docs
2. update the repo skill
3. keep the installed Codex skill in sync if it is being used locally

## Validation

Before closing work that changes app or infra behavior, prefer to run:

- `cd function-app && npm run typecheck`
- `cd function-app && npm test`
- `AZURE_CONFIG_DIR=/tmp/azcli DOTNET_BUNDLE_EXTRACT_BASE_DIR=/tmp/dotnetbundle az bicep build --file infra/main.bicep`
