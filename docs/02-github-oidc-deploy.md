# 02 - GitHub OIDC Deployment

## Goal

Allow GitHub Actions to deploy to Azure without storing an Azure client secret in the repository.

## Create a Deployment App Registration

Create an Entra app registration for GitHub deployments. One per environment is the simplest setup:

- `gh-deployer-hello-dev`
- `gh-deployer-hello-prod`

Capture:

- Application (client) ID
- Directory (tenant) ID
- Azure subscription ID

## Add Federated Credentials

In the app registration, add a federated credential for each GitHub environment and branch you want to trust.

Recommended split:

- `dev` environment for the `dev` branch
- `prod` environment for the `main` branch

## Configure GitHub Environment Variables

Create GitHub environments named `dev` and `prod`, then add:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RG`

## Enable Deployment After Setup

Leave deployment disabled while the repo is still acting as a template or before Azure is ready.

When the Azure side is configured, create this repository variable:

- `ENABLE_AZURE_DEPLOY=true`

Until that variable exists, pushes to `dev` and `main` will skip the deploy job instead of failing.

## Deployment Workflows

Included workflows:

- `.github/workflows/validate-template.yml`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`

## Next Step

Continue with:

- [03 - Promote to Production](./03-promote-to-prod.md)
