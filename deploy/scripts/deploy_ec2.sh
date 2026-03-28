#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/vibefix}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.ec2.yml}"
REVISION="${1:-}"
PRUNE_DANGLING="${PRUNE_DANGLING:-false}"
PRECHECK_SCRIPT="${ROOT_DIR}/deploy/scripts/preflight_ec2.sh"

fail() {
  echo "[deploy] ERROR: $*" >&2
  exit 1
}

compose_cmd() {
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" "$@"
}

wait_for_container_health() {
  local service="$1"
  local path="$2"
  local label="$3"
  local max_attempts="${4:-40}"
  local sleep_secs="${5:-3}"
  local attempt=1

  while (( attempt <= max_attempts )); do
    if compose_cmd exec -T "${service}" \
      sh -lc "wget -q -O- http://localhost:8080${path} >/dev/null 2>&1"; then
      echo "[deploy] ${label} container health check returned HTTP 200."
      return 0
    fi

    echo "[deploy] waiting for ${label}... (${attempt}/${max_attempts})"
    sleep "${sleep_secs}"
    attempt=$((attempt + 1))
  done

  return 1
}

wait_for_https_edge_health() {
  local host="$1"
  local path="$2"
  local label="$3"
  local max_attempts="${4:-60}"
  local sleep_secs="${5:-5}"
  local attempt=1
  local code

  while (( attempt <= max_attempts )); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 \
      --resolve "${host}:443:127.0.0.1" "https://${host}${path}" 2>/dev/null || true)"
    if [[ "${code}" == "200" ]]; then
      echo "[deploy] ${label} edge health check returned HTTP 200."
      return 0
    fi

    echo "[deploy] waiting for ${label} edge health... (${attempt}/${max_attempts}, code=${code:-none})"
    sleep "${sleep_secs}"
    attempt=$((attempt + 1))
  done

  return 1
}

[[ -d "${ROOT_DIR}/.git" ]] || fail "Expected git repository at ${ROOT_DIR}"
[[ -f "${ENV_FILE}" ]] || fail "Missing env file: ${ENV_FILE}"
[[ -f "${COMPOSE_FILE}" ]] || fail "Missing compose file: ${COMPOSE_FILE}"
[[ -x "${PRECHECK_SCRIPT}" ]] || fail "Preflight script missing or not executable: ${PRECHECK_SCRIPT}"

cd "${ROOT_DIR}"

if [[ -n "${REVISION}" ]]; then
  echo "[deploy] Fetching latest refs..."
  git fetch --all --tags --prune
  echo "[deploy] Checking out revision: ${REVISION}"
  git checkout "${REVISION}"
fi

echo "[deploy] Running preflight checks..."
"${PRECHECK_SCRIPT}"

export VIBEFIX_ENV_FILE="${ENV_FILE}"

echo "[deploy] Rendering compose config..."
compose_cmd config >/dev/null

echo "[deploy] Building images..."
compose_cmd build --pull

echo "[deploy] Starting/updating stack..."
compose_cmd up -d --remove-orphans

echo "[deploy] Waiting for runtime checks..."
wait_for_container_health "website-service" "/healthz" "website-service" || fail "Website container health check failed"

echo "[deploy] Waiting for edge HTTPS health checks..."
wait_for_https_edge_health "fixmyvibecodedshit.com" "/healthz" "website-service" || fail "Website edge health check failed"

echo "[deploy] Current container status:"
compose_cmd ps

if [[ "${PRUNE_DANGLING}" == "true" ]]; then
  echo "[deploy] Pruning dangling images..."
  docker image prune -f
fi

echo "[deploy] Deployment completed successfully."
