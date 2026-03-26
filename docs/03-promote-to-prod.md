# 03 - Promote to Prod

## Recommended Flow

1. Confirm the `dev` deployment returns `Hello World`
2. Copy any final naming or tag changes into `infra/main.parameters.prod.json`
3. Create the `prod` deployer app registration, federated credential, and GitHub environment if you have not already
   Recommended command: `./scripts/create-deployer-app.sh prod`
4. Promote to `main`

## Production Checks

Before promoting:

- `function-app` builds locally
- `npm test` passes
- `az bicep build --file infra/main.bicep` succeeds
- The `dev` deployment is reachable in a browser
- the `prod` GitHub environment has `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_RG`
- branch protection on `main` requires the `Validate Template` check

## First Promotion Edge Case

If `main` and `dev` do not share history in a fresh derived repo, a normal merge may fail with `refusing to merge unrelated histories`.

In that case, stop and decide whether `main` should be replaced by the current `dev` history.
If yes, use:

```bash
git push --force-with-lease origin dev:main
```

Use that only when you explicitly want `main` to become the current `dev` deployment line.

## After Deployment

Open the production Function App host name and confirm it returns:

```text
Hello World
```
