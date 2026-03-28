# Vibefix Operations Commands

This is the operational command reference for Vibefix across local development and EC2 deployment.


| Item            | Value                          |
| --------------- | ------------------------------ |
| EC2 repo path   | `/opt/fixmyvibecodedshit`     |
| Local repo path | `/Users/denniswillie/vibefix`  |
| Canonical URL   | `https://fixmyvibecodedshit.com` |


## 0) Shared shell setup

```bash
export REPO_DIR="/opt/fixmyvibecodedshit"
export LOCAL_REPO_DIR="/Users/denniswillie/vibefix"
```

For local-only commands, switch `REPO_DIR` first:

```bash
export REPO_DIR="$LOCAL_REPO_DIR"
```

## 1) EC2 commands

### 1.1 SSH into EC2

```bash
ssh -i /path/to/key.pem ec2-user@<EC2_PUBLIC_IP>
```

### 1.2 Fresh EC2 bootstrap (Amazon Linux 2023)

```bash
sudo dnf update -y
sudo dnf install -y git jq bind-utils docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker

mkdir -p ~/.docker/cli-plugins
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) COMPOSE_ARCH="x86_64" ;;
  aarch64|arm64) COMPOSE_ARCH="aarch64" ;;
  *) echo "Unsupported architecture: $ARCH" && exit 1 ;;
esac
curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-${COMPOSE_ARCH}" \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
docker compose version
```

### 1.3 Clone repo onto EC2

```bash
# Option A: GitHub SSH deploy key
sudo mkdir -p "$REPO_DIR"
sudo chown ec2-user:ec2-user "$REPO_DIR"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "vibefix-ec2-deploy" -f ~/.ssh/id_ed25519 -N ""
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
cat ~/.ssh/id_ed25519.pub
```

Step 2: paste the contents of `~/.ssh/id_ed25519.pub` into GitHub:
- Repo `Settings` -> `Deploy keys` -> `Add deploy key`
- Use the `.pub` file contents only
- Do not paste `~/.ssh/id_ed25519` because that is the private key

```bash
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 644 ~/.ssh/known_hosts
ssh -T git@github.com
git clone git@github.com:<org>/<repo>.git "$REPO_DIR"
```

```bash
# Option B: GitHub PAT over HTTPS
sudo mkdir -p "$REPO_DIR"
sudo chown ec2-user:ec2-user "$REPO_DIR"
git clone "https://<github_user>:<pat>@github.com/<org>/<repo>.git" "$REPO_DIR"
```

### 1.4 First-deploy prerequisites

- Point the `fixmyvibecodedshit.com` and `www.fixmyvibecodedshit.com` DNS `A` records at the EC2 public IP before the first HTTPS deploy.
- Open inbound security-group access for TCP `22`, `80`, and `443`.
- In Google OAuth, set:
  - `Authorized JavaScript origins`: `https://fixmyvibecodedshit.com`
  - `Authorized redirect URIs`: `https://fixmyvibecodedshit.com/auth/google/callback`
- Run the Supabase schema once before the first real login.
- Keep `FRONTEND_URL=https://fixmyvibecodedshit.com`.
- Keep `GOOGLE_OAUTH_REDIRECT_URI=https://fixmyvibecodedshit.com/auth/google/callback`.
- Keep `ALLOWED_ORIGINS=https://fixmyvibecodedshit.com,https://www.fixmyvibecodedshit.com`.

### 1.5 Create the EC2 `.env`

```bash
cd "$REPO_DIR"
cp deploy/env/.env.ec2.example .env
```

Edit `.env` and set the real values:

```env
NODE_ENV=production
PORT=8080
LETSENCRYPT_EMAIL=you@example.com
FRONTEND_URL=https://fixmyvibecodedshit.com
ALLOWED_ORIGINS=https://fixmyvibecodedshit.com,https://www.fixmyvibecodedshit.com
SESSION_COOKIE_NAME=vibefix_session
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=https://fixmyvibecodedshit.com/auth/google/callback
DB_HOST=aws-1-eu-central-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.<your-project-ref>
DB_PASSWORD=<your-db-password>
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
```

### 1.6 Make deploy scripts executable

```bash
cd "$REPO_DIR"
chmod +x \
  "$REPO_DIR/deploy/scripts/preflight_ec2.sh" \
  "$REPO_DIR/deploy/scripts/deploy_ec2.sh"
```

### 1.7 Apply the Supabase schema

```bash
cd "$REPO_DIR"
set -a
source "$REPO_DIR/.env"
set +a

psql "host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME} user=${DB_USER} password=${DB_PASSWORD} sslmode=require connect_timeout=10" \
  -v ON_ERROR_STOP=1 \
  -f "$REPO_DIR/db/supabase_schema.sql"
```

### 1.8 Preflight checks

```bash
cd "$REPO_DIR"
bash "$REPO_DIR/deploy/scripts/preflight_ec2.sh"
```

### 1.9 Full deploy

```bash
cd "$REPO_DIR"
bash "$REPO_DIR/deploy/scripts/deploy_ec2.sh"
```

### 1.10 Redeploy after pulling latest code

```bash
cd "$REPO_DIR"
git pull
bash "$REPO_DIR/deploy/scripts/deploy_ec2.sh"
```

### 1.11 Logs for key services

```bash
cd "$REPO_DIR"
docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.ec2.yml" \
  logs --tail 100 -f caddy website-service
```

### 1.12 Health and status checks

```bash
cd "$REPO_DIR"
docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.ec2.yml" ps

curl -I https://fixmyvibecodedshit.com/healthz
curl -I https://www.fixmyvibecodedshit.com
```

### 1.13 Manual compose commands

```bash
cd "$REPO_DIR"
docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.ec2.yml" build
docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.ec2.yml" up -d
docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.ec2.yml" down
```

### 1.14 Rotate secrets and reload stack

```bash
cd "$REPO_DIR"
# Edit .env first
docker compose --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.ec2.yml" \
  up -d --build --force-recreate
```

### 1.15 Disk cleanup

```bash
docker system df
docker builder prune -f
docker image prune -f
# Stronger cleanup (careful):
# docker system prune -af
```

### 1.16 Optional swap for small EC2 instances

```bash
sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
swapon --show
free -h
```

## 2) Local commands

### 2.1 Frontend dev server

```bash
cd "$LOCAL_REPO_DIR"
npm install
npm run dev
```

### 2.2 Backend dev server

```bash
cd "$LOCAL_REPO_DIR/services/website-service"
npm install
npm run dev
```

### 2.3 Frontend tests

```bash
cd "$LOCAL_REPO_DIR"
npm test
```

### 2.4 Backend tests

```bash
cd "$LOCAL_REPO_DIR/services/website-service"
npm test
```

### 2.5 Production build

```bash
cd "$LOCAL_REPO_DIR"
npm run build
```
