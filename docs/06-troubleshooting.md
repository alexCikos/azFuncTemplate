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
- The repository variable `ENABLE_AZURE_DEPLOY` is set to `true`
- The OIDC federated credential matches the repo and environment trust mapping expected by the workflow
- `AZURE_RG` points at the resource group created by the bootstrap script

## `scripts/create-deployer-app.sh` cannot detect the repo

Check:

- `git remote -v` shows `origin`
- the remote is a GitHub URL that resolves to `<owner>/<repo>`

If needed, rerun with:

```bash
./scripts/create-deployer-app.sh dev --repo <owner>/<repo>
```

## `scripts/create-deployer-app.sh` fails while assigning the role

The service principal may not have fully propagated yet.

Wait a minute, then rerun the script.

## GitHub Actions OIDC login fails

Check:

- the federated credential subject matches `repo:<owner>/<repo>:environment:<env>`
- the workflow environment name still matches `dev` or `prod`
- `AZURE_CLIENT_ID` points at the deployer app registration created for that environment

## `git push` fails with `Invalid username or token`

Check:

- `gh auth status`
- `gh auth setup-git`

Then retry the push.

## Prod promotion fails with `refusing to merge unrelated histories`

Check whether `main` and `dev` were created from different histories in a fresh repo.

If `main` should be replaced by the working `dev` history, use:

```bash
git push --force-with-lease origin dev:main
```

## GitHub Actions deployment is skipped

Check whether this is still a fresh template repo.

The deploy jobs intentionally stay inactive until:

- Azure has been configured
- GitHub `dev` and `prod` environments exist
- the repository variable `ENABLE_AZURE_DEPLOY` is set to `true`

## Bicep validation fails

Run locally:

```bash
az bicep build --file infra/main.bicep
```

Then check the matching parameter file for invalid values.
