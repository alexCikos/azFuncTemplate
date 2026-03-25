# 00 - Start Here

## What This Template Does

This template gives you a minimal Azure Functions baseline:

- Deploy infrastructure with Bicep
- Deploy code from GitHub with OIDC
- Return `Hello World` from the root URL
- Give you a clean place to start building real features

## Architecture Mental Model

Deployment path:

1. Push to `dev` or `main`
2. GitHub Actions checks whether deployment has been explicitly enabled for this repo
3. After setup is complete and `ENABLE_AZURE_DEPLOY=true`, GitHub Actions logs into Azure through OIDC
4. Bicep deploys or updates the Function App infrastructure
5. The function app is built, zipped, and deployed

Runtime path:

1. Azure receives an anonymous HTTP request on `/`
2. The function returns plain text `Hello World`

## Success Check

The template is working when both of these succeed:

- `http://localhost:7071/` returns `Hello World`
- `https://<your-function-host>/` returns `Hello World` after deployment

Fresh template pushes are expected to skip deployment until Azure setup is finished.

## Reading Order

Continue with:

- [01 - Bootstrap Dev Environment](./01-bootstrap-dev.md)
