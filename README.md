# Azure Functions Hello World Template

This repository is a reusable Azure Functions skeleton. It deploys a minimal TypeScript Function App to Azure, exposes the root URL `/`, and returns plain-text `Hello World` so you can confirm the platform works before layering on real features.

## What You Get

- Azure Functions v4 with Node.js 22 and TypeScript
- Bicep infrastructure for Storage, Function App, Log Analytics, and Application Insights
- GitHub Actions deployment for `dev` and `main` using OIDC
- A bootstrap script for first-time resource-group setup
- A tiny test suite that validates the starter response

## Runtime Behavior

After deployment, browsing to the Function App host returns:

```text
Hello World
```

Locally, the same response is available at:

```text
http://localhost:7071/
```

## Repository Layout

- `function-app/` Azure Functions application code
- `infra/` Bicep template and environment parameter files
- `.github/workflows/` validation and deployment workflows
- `scripts/bootstrap-environment.sh` one-command infrastructure bootstrap
- `docs/` setup, deployment, local-development, and customization guides

## Quick Start

1. Use Node 22:

   ```bash
   nvm use
   ```

2. Install dependencies and start the function locally:

   ```bash
   cd function-app
   npm ci
   cp local.settings.sample.json local.settings.json
   npm start
   ```

3. Open [http://localhost:7071/](http://localhost:7071/) or run:

   ```bash
   curl http://localhost:7071/
   ```

## Deploy to Azure

Fresh template repos are safe to push immediately. The deploy workflows stay inactive until you finish the Azure setup and set the repository variable `ENABLE_AZURE_DEPLOY=true`.

1. Update `infra/main.parameters.dev.json` and `infra/main.parameters.prod.json`
2. Bootstrap the target environment:

   ```bash
   ./scripts/bootstrap-environment.sh dev
   ```

3. Configure GitHub OIDC, GitHub environment variables, and the repository variable `ENABLE_AZURE_DEPLOY=true`
4. Push to `dev` for the development deployment, then `main` for production

## Docs Map

1. [docs/00-start-here.md](./docs/00-start-here.md)
2. [docs/01-bootstrap-dev.md](./docs/01-bootstrap-dev.md)
3. [docs/02-github-oidc-deploy.md](./docs/02-github-oidc-deploy.md)
4. [docs/03-promote-to-prod.md](./docs/03-promote-to-prod.md)
5. [docs/04-customize-template.md](./docs/04-customize-template.md)
6. [docs/05-local-development.md](./docs/05-local-development.md)
7. [docs/06-troubleshooting.md](./docs/06-troubleshooting.md)
8. [docs/07-next-steps.md](./docs/07-next-steps.md)

## Deep Reference

Longer operational notes live in [knowledgeBase.md](./knowledgeBase.md).
