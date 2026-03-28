#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/vibefix}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.ec2.yml}"

fail() {
  echo "[preflight] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "${cmd}" >/dev/null 2>&1 || fail "Missing required command: ${cmd}"
}

require_env_key() {
  local key="$1"
  grep -Eq "^${key}=" "${ENV_FILE}" || fail "Missing '${key}' in ${ENV_FILE}"
}

require_cmd docker
require_cmd curl

docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is required"

[[ -f "${ENV_FILE}" ]] || fail "Missing env file: ${ENV_FILE}"
[[ -f "${COMPOSE_FILE}" ]] || fail "Missing compose file: ${COMPOSE_FILE}"
[[ -f "${ROOT_DIR}/deploy/caddy/Caddyfile" ]] || fail "Missing Caddyfile"

require_env_key LETSENCRYPT_EMAIL
require_env_key FRONTEND_URL
require_env_key ALLOWED_ORIGINS
require_env_key GOOGLE_OAUTH_CLIENT_ID
require_env_key GOOGLE_OAUTH_CLIENT_SECRET
require_env_key GOOGLE_OAUTH_REDIRECT_URI
require_env_key DB_HOST
require_env_key DB_PORT
require_env_key DB_NAME
require_env_key DB_USER
require_env_key DB_PASSWORD

echo "[preflight] docker, compose, env file, and deploy config look present."
