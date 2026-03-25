# 03 - Promote to Prod

## Recommended Flow

1. Confirm the `dev` deployment returns `Hello World`
2. Copy any final naming or tag changes into `infra/main.parameters.prod.json`
3. Create the `prod` GitHub environment if you have not already
4. Push or merge to `main`

## Production Checks

Before promoting:

- `function-app` builds locally
- `npm test` passes
- `az bicep build --file infra/main.bicep` succeeds
- The `dev` deployment is reachable in a browser

## After Deployment

Open the production Function App host name and confirm it returns:

```text
Hello World
```
