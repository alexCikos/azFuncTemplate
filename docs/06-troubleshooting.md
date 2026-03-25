# 06 - Troubleshooting

## `func start` fails locally

Check:

- Node 22 is active: `node -v`
- Azure Functions Core Tools is installed: `func --version`
- `function-app/local.settings.json` exists

## The root URL does not return `Hello World`

Check:

- `function-app/host.json` keeps `"routePrefix": ""`
- `function-app/src/functions/helloWorld.ts` still registers `route: ""`
- The app was rebuilt after changes: `npm run build`

## GitHub Actions deployment fails before code deploy

Check:

- GitHub environment variables are set correctly
- The OIDC federated credential matches the branch and environment
- `AZURE_RG` points at the resource group created by the bootstrap script

## Bicep validation fails

Run locally:

```bash
az bicep build --file infra/main.bicep
```

Then check the matching parameter file for invalid values.
