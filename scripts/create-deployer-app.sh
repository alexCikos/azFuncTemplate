#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/create-deployer-app.sh <environment> [--repo <owner/repo>] [--subscription <subscription-id>] [--resource-group <resource-group>]

Examples:
  ./scripts/create-deployer-app.sh dev
  ./scripts/create-deployer-app.sh prod
  ./scripts/create-deployer-app.sh dev --repo octo-org/hello-template
  ./scripts/create-deployer-app.sh prod --subscription 00000000-0000-0000-0000-000000000000 --resource-group rg-hello-template-prod

What it does:
  1. Creates or reuses the deployer Entra app registration
  2. Creates or reuses the matching service principal
  3. Creates or updates the GitHub Actions federated credential
  4. Grants Contributor on the target resource group
  5. Prints the GitHub variables and gh commands to run next
EOF
}

detect_repo_slug() {
  local remote_url
  remote_url="$(git config --get remote.origin.url || true)"

  if [[ -z "$remote_url" ]]; then
    return 1
  fi

  remote_url="${remote_url%.git}"

  case "$remote_url" in
    git@github.com:*)
      printf '%s\n' "${remote_url#git@github.com:}"
      ;;
    https://github.com/*)
      printf '%s\n' "${remote_url#https://github.com/}"
      ;;
    ssh://git@github.com/*)
      printf '%s\n' "${remote_url#ssh://git@github.com/}"
      ;;
    *)
      return 1
      ;;
  esac
}

wait_for_service_principal() {
  local app_id="$1"
  local sp_object_id=""

  for attempt in 1 2 3 4 5 6; do
    sp_object_id="$(az ad sp show --id "$app_id" --query id --output tsv 2>/dev/null || true)"
    if [[ -n "$sp_object_id" ]]; then
      printf '%s\n' "$sp_object_id"
      return 0
    fi
    sleep 10
  done

  return 1
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 1
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ENVIRONMENT_NAME="$1"
shift

REPO_SLUG=""
SUBSCRIPTION_ID=""
RESOURCE_GROUP=""
PARAM_FILE="infra/main.parameters.${ENVIRONMENT_NAME}.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_SLUG="${2:-}"
      shift 2
      ;;
    --subscription)
      SUBSCRIPTION_ID="${2:-}"
      shift 2
      ;;
    --resource-group)
      RESOURCE_GROUP="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$ENVIRONMENT_NAME" != "dev" && "$ENVIRONMENT_NAME" != "prod" ]]; then
  echo "Unsupported environment: $ENVIRONMENT_NAME. Allowed: dev, prod." >&2
  exit 1
fi

if [[ ! -f "$PARAM_FILE" ]]; then
  echo "Parameter file not found: $PARAM_FILE" >&2
  exit 1
fi

for cmd in az git node; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
done

NAME_PREFIX="$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=p.parameters?.namePrefix?.value;if(!v){process.exit(2)};process.stdout.write(String(v));' "$PARAM_FILE" || true)"
PARAM_ENVIRONMENT_NAME="$(node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=p.parameters?.environmentName?.value;if(!v){process.exit(2)};process.stdout.write(String(v));' "$PARAM_FILE" || true)"

if [[ -z "$NAME_PREFIX" || -z "$PARAM_ENVIRONMENT_NAME" ]]; then
  echo "Parameter file must include parameters.namePrefix.value and parameters.environmentName.value: $PARAM_FILE" >&2
  exit 1
fi

if [[ "$PARAM_ENVIRONMENT_NAME" != "$ENVIRONMENT_NAME" ]]; then
  echo "Environment mismatch: argument is '$ENVIRONMENT_NAME' but $PARAM_FILE sets environmentName='$PARAM_ENVIRONMENT_NAME'." >&2
  exit 1
fi

if [[ -z "$RESOURCE_GROUP" ]]; then
  RESOURCE_GROUP="rg-${NAME_PREFIX}-${ENVIRONMENT_NAME}"
fi

if [[ -z "$REPO_SLUG" ]]; then
  REPO_SLUG="$(detect_repo_slug || true)"
fi

if [[ -z "$REPO_SLUG" ]]; then
  echo "Unable to detect the GitHub repo slug from remote.origin.url." >&2
  echo "Pass it explicitly with --repo <owner/repo>." >&2
  exit 1
fi

if [[ ! "$REPO_SLUG" =~ ^[^/]+/[^/]+$ ]]; then
  echo "Invalid repo slug: $REPO_SLUG. Expected <owner>/<repo>." >&2
  exit 1
fi

APP_DISPLAY_NAME="gh-deployer-${NAME_PREFIX}-${ENVIRONMENT_NAME}"
FEDERATED_CREDENTIAL_NAME="github-${ENVIRONMENT_NAME}"
FEDERATED_SUBJECT="repo:${REPO_SLUG}:environment:${ENVIRONMENT_NAME}"
FEDERATED_DESCRIPTION="GitHub Actions OIDC for ${REPO_SLUG} (${ENVIRONMENT_NAME})"

echo "Checking Azure login..."
if ! az account show >/dev/null 2>&1; then
  az login >/dev/null
fi

if [[ -n "$SUBSCRIPTION_ID" ]]; then
  az account set --subscription "$SUBSCRIPTION_ID"
else
  SUBSCRIPTION_ID="$(az account show --query id --output tsv)"
fi

TENANT_ID="$(az account show --query tenantId --output tsv)"
SCOPE="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"

RESOURCE_GROUP_EXISTS="$(az group exists --name "$RESOURCE_GROUP" --output tsv)"
if [[ "$RESOURCE_GROUP_EXISTS" != "true" ]]; then
  echo "Resource group does not exist: $RESOURCE_GROUP" >&2
  echo "Run ./scripts/bootstrap-environment.sh ${ENVIRONMENT_NAME} first, or pass --resource-group with an existing resource group." >&2
  exit 1
fi

mapfile -t APP_IDS < <(az ad app list --display-name "$APP_DISPLAY_NAME" --query "[?displayName=='${APP_DISPLAY_NAME}'].appId" --output tsv)

if [[ ${#APP_IDS[@]} -gt 1 ]]; then
  echo "Multiple Entra apps already use the display name '$APP_DISPLAY_NAME'." >&2
  echo "Resolve the duplicates manually, then rerun this script." >&2
  printf 'Found app IDs:\n%s\n' "${APP_IDS[*]}" >&2
  exit 1
fi

if [[ ${#APP_IDS[@]} -eq 1 && -n "${APP_IDS[0]}" ]]; then
  APP_ID="${APP_IDS[0]}"
  echo "Reusing existing app registration: $APP_DISPLAY_NAME ($APP_ID)"
else
  echo "Creating app registration: $APP_DISPLAY_NAME"
  APP_ID="$(az ad app create --display-name "$APP_DISPLAY_NAME" --sign-in-audience AzureADMyOrg --query appId --output tsv)"
fi

SP_OBJECT_ID="$(az ad sp show --id "$APP_ID" --query id --output tsv 2>/dev/null || true)"
if [[ -z "$SP_OBJECT_ID" ]]; then
  echo "Creating service principal for app: $APP_ID"
  az ad sp create --id "$APP_ID" >/dev/null
  SP_OBJECT_ID="$(wait_for_service_principal "$APP_ID" || true)"
fi

if [[ -z "$SP_OBJECT_ID" ]]; then
  echo "Service principal was not visible after creation. Wait a minute, then rerun the script." >&2
  exit 1
fi

FEDERATED_PARAMS="$(mktemp)"
trap 'rm -f "$FEDERATED_PARAMS"' EXIT

cat >"$FEDERATED_PARAMS" <<EOF
{
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "${FEDERATED_SUBJECT}",
  "description": "${FEDERATED_DESCRIPTION}",
  "audiences": [
    "api://AzureADTokenExchange"
  ]
}
EOF

EXISTING_FEDERATED_SUBJECT="$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='${FEDERATED_CREDENTIAL_NAME}'].subject | [0]" --output tsv)"

if [[ -n "$EXISTING_FEDERATED_SUBJECT" ]]; then
  echo "Updating federated credential: $FEDERATED_CREDENTIAL_NAME"
  az ad app federated-credential update \
    --id "$APP_ID" \
    --federated-credential-id "$FEDERATED_CREDENTIAL_NAME" \
    --parameters "$FEDERATED_PARAMS" >/dev/null
else
  echo "Creating federated credential: $FEDERATED_CREDENTIAL_NAME"
  FEDERATED_CREATE_PARAMS="$(mktemp)"
  trap 'rm -f "$FEDERATED_PARAMS" "$FEDERATED_CREATE_PARAMS"' EXIT
  cat >"$FEDERATED_CREATE_PARAMS" <<EOF
{
  "name": "${FEDERATED_CREDENTIAL_NAME}",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "${FEDERATED_SUBJECT}",
  "description": "${FEDERATED_DESCRIPTION}",
  "audiences": [
    "api://AzureADTokenExchange"
  ]
}
EOF
  az ad app federated-credential create --id "$APP_ID" --parameters "$FEDERATED_CREATE_PARAMS" >/dev/null
fi

EXISTING_ROLE_ASSIGNMENT_ID="$(az role assignment list \
  --assignee-object-id "$SP_OBJECT_ID" \
  --scope "$SCOPE" \
  --role Contributor \
  --fill-principal-name false \
  --query "[0].id" \
  --output tsv)"

if [[ -n "$EXISTING_ROLE_ASSIGNMENT_ID" ]]; then
  echo "Contributor role assignment already exists on $RESOURCE_GROUP"
else
  echo "Creating Contributor role assignment on resource group: $RESOURCE_GROUP"
  ROLE_ASSIGNED="false"
  for attempt in 1 2 3 4 5 6; do
    if az role assignment create \
      --assignee-object-id "$SP_OBJECT_ID" \
      --assignee-principal-type ServicePrincipal \
      --role Contributor \
      --scope "$SCOPE" >/dev/null 2>&1; then
      ROLE_ASSIGNED="true"
      break
    fi
    sleep 10
  done

  if [[ "$ROLE_ASSIGNED" != "true" ]]; then
    echo "Failed to create the Contributor role assignment after multiple attempts." >&2
    echo "Wait a minute for Entra propagation, then rerun the script." >&2
    exit 1
  fi
fi

cat <<SUMMARY

Deployer app setup complete.

Environment: $ENVIRONMENT_NAME
Parameter file: $PARAM_FILE
Repo: $REPO_SLUG
Subscription: $SUBSCRIPTION_ID
Tenant: $TENANT_ID
Resource group: $RESOURCE_GROUP
App registration: $APP_DISPLAY_NAME
Client ID: $APP_ID
Service principal object ID: $SP_OBJECT_ID
Federated subject: $FEDERATED_SUBJECT
Role scope: $SCOPE

Set these GitHub environment variables (environment: $ENVIRONMENT_NAME):
- AZURE_CLIENT_ID=$APP_ID
- AZURE_TENANT_ID=$TENANT_ID
- AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
- AZURE_RG=$RESOURCE_GROUP

Suggested GitHub CLI commands:
gh api --method PUT repos/$REPO_SLUG/environments/$ENVIRONMENT_NAME
gh variable set AZURE_CLIENT_ID --env "$ENVIRONMENT_NAME" --body "$APP_ID"
gh variable set AZURE_TENANT_ID --env "$ENVIRONMENT_NAME" --body "$TENANT_ID"
gh variable set AZURE_SUBSCRIPTION_ID --env "$ENVIRONMENT_NAME" --body "$SUBSCRIPTION_ID"
gh variable set AZURE_RG --env "$ENVIRONMENT_NAME" --body "$RESOURCE_GROUP"

After both environments are ready, enable deployment:
gh variable set ENABLE_AZURE_DEPLOY --body true
SUMMARY
