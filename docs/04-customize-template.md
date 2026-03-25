# 04 - Customize the Template

## Change the Response

Update `function-app/src/functions/helloWorld.ts` to replace the starter response with your own logic.

## Add More Functions

Add more files under `function-app/src/functions/` and register them with `app.http`, `app.timer`, or any other supported trigger type.

## Add App Settings

If your feature needs configuration:

1. Add the new app setting in `infra/main.bicep`
2. Add local values in `function-app/local.settings.json`
3. Document it in `README.md` or the relevant doc

## Change the Deployment Region or Naming

Update:

- `infra/main.parameters.dev.json`
- `infra/main.parameters.prod.json`

The `namePrefix` feeds the generated Azure resource names.
