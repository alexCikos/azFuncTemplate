# 05 - Local Development

## First-Time Setup

```bash
nvm use
cd function-app
npm ci
cp local.settings.sample.json local.settings.json
```

## Start the Function App

```bash
npm start
```

Open:

- `http://localhost:7071/`

Or test with:

```bash
curl http://localhost:7071/
```

Expected result:

```text
Hello World
```

## Local Settings

The sample file already includes the minimum settings required for a local HTTP-only app:

- `AzureWebJobsStorage`
- `FUNCTIONS_WORKER_RUNTIME`
