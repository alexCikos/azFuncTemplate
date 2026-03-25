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

It also includes optional Graph settings for derived projects:

- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_SCOPE`

Leave those blank unless the project is using the Graph utility code.
