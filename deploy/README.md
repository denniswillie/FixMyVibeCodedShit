# EC2 Deploy

This repo can run on a single EC2 instance with Docker Compose and Caddy.

## Files

- `docker-compose.ec2.yml`: production stack with `website-service` and `caddy`
- `services/website-service/Dockerfile`: multi-stage image that builds the frontend and serves it through the Express backend
- `deploy/caddy/Caddyfile`: TLS + reverse proxy for `fixmyvibecodedshit.com`
- `deploy/env/.env.ec2.example`: example environment file for the EC2 box
- `deploy/scripts/preflight_ec2.sh`: checks docker/compose/env before deploy
- `deploy/scripts/deploy_ec2.sh`: build and roll the stack on the server

## Suggested EC2 layout

Clone the repo to:

```bash
/opt/fixmyvibecodedshit
```

Create:

```bash
/opt/fixmyvibecodedshit/.env
```

You can start from `deploy/env/.env.ec2.example`.

## First deploy

```bash
cd /opt/fixmyvibecodedshit
chmod +x deploy/scripts/preflight_ec2.sh deploy/scripts/deploy_ec2.sh
./deploy/scripts/deploy_ec2.sh
```

## Manual compose commands

```bash
docker compose --env-file .env -f docker-compose.ec2.yml build
docker compose --env-file .env -f docker-compose.ec2.yml up -d
docker compose --env-file .env -f docker-compose.ec2.yml logs -f website-service
```
