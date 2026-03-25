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
2. GitHub Actions logs into Azure through OIDC
3. Bicep deploys or updates the Function App infrastructure
4. The function app is built, zipped, and deployed

Runtime path:

1. Azure receives an anonymous HTTP request on `/`
2. The function returns plain text `Hello World`

## Success Check

The template is working when both of these succeed:

- `http://localhost:7071/` returns `Hello World`
- `https://<your-function-host>/` returns `Hello World` after deployment

## Reading Order

Continue with:

- [01 - Bootstrap Dev Environment](./01-bootstrap-dev.md)
