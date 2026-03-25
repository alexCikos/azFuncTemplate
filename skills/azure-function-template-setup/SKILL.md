---
name: azure-function-template-setup
description: Guide a user through setting up, validating, bootstrapping, deploying, and troubleshooting the Azure Functions Hello World template in the current workspace. Use when the user wants help configuring Azure, reviewing `infra/main.parameters.*.json`, running `scripts/bootstrap-environment.sh`, setting up GitHub OIDC environments, verifying local `Hello World`, promoting from `dev` to `main`, or troubleshooting this template. Read the workspace docs and deployment files first, then guide the user step by step and ask for confirmation before any Azure-changing, GitHub-changing, branch-changing, or cost-incurring action.
---

# Azure Function Template Setup

## Overview

Guide the user through this repository's setup flow from local readiness to Azure deployment.
Use the workspace files as the source of truth.
State clearly when the workspace does not match this template, because this skill assumes the Azure Functions Hello World template structure.

## Load Context First

Read these files before recommending or running setup work:

- `README.md`
- `docs/00-start-here.md`
- `docs/01-bootstrap-dev.md`
- `docs/02-github-oidc-deploy.md`
- `docs/03-promote-to-prod.md`
- `docs/05-local-development.md`
- `docs/06-troubleshooting.md`
- `knowledgeBase.md`

Inspect these files when the task moves into execution or troubleshooting:

- `infra/main.bicep`
- `infra/main.parameters.dev.json`
- `infra/main.parameters.prod.json`
- `scripts/bootstrap-environment.sh`
- `.github/workflows/validate-template.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`
- `function-app/local.settings.sample.json`
- `function-app/src/functions/helloWorld.ts`
- `function-app/host.json`

Read `docs/04-customize-template.md` and `docs/07-next-steps.md` only when the user wants to extend the starter after setup.
Read `docs/08-optional-microsoft-graph-setup.md` when the user wants SharePoint, Graph, or app-only mailbox integration in a derived project.

## Workflow

### 1. Assess the Current Stage

Determine whether the user wants:

- local setup
- Azure bootstrap
- GitHub OIDC configuration
- dev deployment
- prod promotion
- troubleshooting

Summarize current status, missing prerequisites, and the next recommended step in a short checklist.

### 2. Verify Prerequisites

Confirm or help verify:

- Node 22 is available
- npm is available
- Azure Functions Core Tools is available
- Azure CLI is available
- the workspace matches this template structure

Run the relevant local checks when the user wants hands-on help.

### 3. Guide Local Readiness

Walk the user through:

- `nvm use`
- `cd function-app`
- `npm ci`
- copy `local.settings.sample.json` to `local.settings.json`
- `npm start`
- verify `http://localhost:7071/` returns `Hello World`

Use this phase before cloud deployment when local confidence is missing.

### 4. Guide Azure Bootstrap

Review `infra/main.parameters.dev.json` or `infra/main.parameters.prod.json` with the user before running anything.
Explain what `location`, `namePrefix`, and `tags` control.
Use `./scripts/bootstrap-environment.sh <env> [subscription-id] [resource-group]` for first-time environment creation.

After a successful bootstrap, capture and restate:

- resource group
- Function App name
- Function host URL
- GitHub environment variables the script expects next

### 5. Guide GitHub OIDC Setup

Walk the user through:

- creating a deployment Entra app registration
- adding federated credentials for `dev` and `prod`
- setting `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_RG`
- setting the repository variable `ENABLE_AZURE_DEPLOY=true` only after Azure and GitHub environments are ready
- understanding which workflow deploys which branch

Use the workflow files to explain how deployment works.

### 6. Guide Deployment Verification

Before recommending a push, confirm:

- `npm test` passes
- `az bicep build --file infra/main.bicep` passes
- dev parameters are final enough to deploy

After deployment, verify success by checking that the Function App root URL returns `Hello World`.
If deployment is still disabled, explain that skipped deploy jobs are expected until `ENABLE_AZURE_DEPLOY=true` is configured.

### 7. Guide Production Promotion

Use the `dev` deployment as the gate.
Then help the user:

- review `infra/main.parameters.prod.json`
- confirm the `prod` GitHub environment exists
- promote from `dev` to `main`
- verify the production Function App root URL returns `Hello World`

### 8. Troubleshoot from Workspace State

Inspect the live workspace first and then use `docs/06-troubleshooting.md`.
Prefer concrete diagnosis over generic Azure advice.
If docs and code disagree, trust the current workspace and mention the mismatch.

## Confirmation Rules

Ask for explicit confirmation before:

- `az login`
- any `az` command that creates, updates, or deletes Azure resources
- running `scripts/bootstrap-environment.sh`
- editing `infra/main.parameters.*.json`
- pushing or merging branches
- changing GitHub environment settings
- any action that may incur Azure cost

Ask one concise question at a time.

## Execution Style

Keep the user oriented with short progress updates.
Prefer a phase-based checklist over a long wall of instructions.
When the user asks for active help, do the work instead of only describing it, but still pause at confirmation boundaries.
When the user only wants guidance, do not execute cloud actions.

## Success Criteria

Treat setup as complete when:

- local `http://localhost:7071/` returns `Hello World`, or the user explicitly skips local testing
- the target Azure environment is bootstrapped
- GitHub OIDC variables are configured for the chosen environment
- the deployed Function App root URL returns `Hello World`
