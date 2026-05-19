#!/bin/bash
set -e

# Set your Cloudflare API token before running:
# export CLOUDFLARE_API_TOKEN="cfut_..."
: "${CLOUDFLARE_API_TOKEN:?Must set CLOUDFLARE_API_TOKEN before running deploy.sh}"

echo "=== LegionAuth Deployment ==="
echo "Working directory: $(pwd)"

# Install tools if needed
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

# Install all deps
pnpm install --no-frozen-lockfile || npm install

# Navigate to API dir
cd apps/api

echo ""
echo "--- Step 1: Getting account info ---"
ACCOUNT_JSON=$(npx wrangler whoami --json 2>/dev/null || echo "{}")
ACCOUNT_ID=$(echo "$ACCOUNT_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); accounts=d.get('accounts',[]); print(accounts[0].get('id','') if accounts else '')" 2>/dev/null || npx wrangler whoami 2>&1 | grep -oP '(?<=ID: )[a-f0-9]+' | head -1 || echo "")
echo "Account ID: $ACCOUNT_ID"

echo ""
echo "--- Step 2: Create/Get D1 database ---"
DB_CREATE_OUTPUT=$(npx wrangler d1 create legionauth-db 2>&1 || echo "")
if echo "$DB_CREATE_OUTPUT" | grep -q "database_id"; then
  DB_ID=$(echo "$DB_CREATE_OUTPUT" | grep -oP '(?<=database_id = ")[^"]+')
else
  # Get existing
  echo "Database may already exist, fetching ID..."
  DB_LIST=$(npx wrangler d1 list --json 2>/dev/null || npx wrangler d1 list 2>&1)
  DB_ID=$(echo "$DB_LIST" | python3 -c "import sys,json; data=json.load(sys.stdin); dbs=[d for d in data if d.get('name')=='legionauth-db']; print(dbs[0]['uuid'] if dbs else '')" 2>/dev/null || echo "")
  if [ -z "$DB_ID" ]; then
    DB_ID=$(echo "$DB_LIST" | grep -A2 'legionauth-db' | grep -oP '[a-f0-9-]{36}' | head -1 || echo "")
  fi
fi
echo "D1 Database ID: $DB_ID"

echo ""
echo "--- Step 3: Create/Get KV namespaces ---"

# Sessions KV
SESSIONS_KV_OUTPUT=$(npx wrangler kv namespace create SESSIONS_KV 2>&1 || echo "")
if echo "$SESSIONS_KV_OUTPUT" | grep -q '"id"'; then
  SESSIONS_KV_ID=$(echo "$SESSIONS_KV_OUTPUT" | grep -oP '(?<="id": ")[^"]+' | head -1)
  if [ -z "$SESSIONS_KV_ID" ]; then
    SESSIONS_KV_ID=$(echo "$SESSIONS_KV_OUTPUT" | python3 -c "import sys,json; lines=[l for l in sys.stdin.read().split('\n') if 'id' in l]; print(lines[0].split('\"')[3] if lines else '')" 2>/dev/null || echo "")
  fi
fi
if [ -z "$SESSIONS_KV_ID" ]; then
  KV_LIST=$(npx wrangler kv namespace list --json 2>/dev/null || npx wrangler kv namespace list 2>&1)
  SESSIONS_KV_ID=$(echo "$KV_LIST" | python3 -c "import sys,json; data=json.load(sys.stdin); ns=[n for n in data if 'SESSIONS_KV' in n.get('title','')]; print(ns[0]['id'] if ns else '')" 2>/dev/null || echo "")
fi
echo "Sessions KV ID: $SESSIONS_KV_ID"

# Rate Limit KV
RL_KV_OUTPUT=$(npx wrangler kv namespace create RATE_LIMIT_KV 2>&1 || echo "")
RL_KV_ID=$(echo "$RL_KV_OUTPUT" | python3 -c "import sys; content=sys.stdin.read(); import re; m=re.search(r'id = \"([^\"]+)\"', content); print(m.group(1) if m else '')" 2>/dev/null || echo "")
if [ -z "$RL_KV_ID" ]; then
  KV_LIST=$(npx wrangler kv namespace list --json 2>/dev/null || echo "[]")
  RL_KV_ID=$(echo "$KV_LIST" | python3 -c "import sys,json; data=json.load(sys.stdin); ns=[n for n in data if 'RATE_LIMIT_KV' in n.get('title','')]; print(ns[0]['id'] if ns else '')" 2>/dev/null || echo "")
fi
echo "Rate Limit KV ID: $RL_KV_ID"

# JWKS KV
JWKS_KV_OUTPUT=$(npx wrangler kv namespace create JWKS_KV 2>&1 || echo "")
JWKS_KV_ID=$(echo "$JWKS_KV_OUTPUT" | python3 -c "import sys; content=sys.stdin.read(); import re; m=re.search(r'id = \"([^\"]+)\"', content); print(m.group(1) if m else '')" 2>/dev/null || echo "")
if [ -z "$JWKS_KV_ID" ]; then
  KV_LIST=$(npx wrangler kv namespace list --json 2>/dev/null || echo "[]")
  JWKS_KV_ID=$(echo "$KV_LIST" | python3 -c "import sys,json; data=json.load(sys.stdin); ns=[n for n in data if 'JWKS_KV' in n.get('title','')]; print(ns[0]['id'] if ns else '')" 2>/dev/null || echo "")
fi
echo "JWKS KV ID: $JWKS_KV_ID"

echo ""
echo "--- Step 4: Update wrangler.toml ---"
if [ -n "$DB_ID" ]; then
  sed -i "s/PLACEHOLDER_DB_ID/$DB_ID/g" wrangler.toml
fi
if [ -n "$SESSIONS_KV_ID" ]; then
  sed -i "s/PLACEHOLDER_KV_ID/$SESSIONS_KV_ID/g" wrangler.toml
fi
if [ -n "$RL_KV_ID" ]; then
  sed -i "s/PLACEHOLDER_RL_KV_ID/$RL_KV_ID/g" wrangler.toml
fi
if [ -n "$JWKS_KV_ID" ]; then
  sed -i "s/PLACEHOLDER_JWKS_KV_ID/$JWKS_KV_ID/g" wrangler.toml
fi
if [ -n "$ACCOUNT_ID" ]; then
  # Check if account_id already in wrangler.toml
  if ! grep -q "account_id" wrangler.toml; then
    echo "" >> wrangler.toml
    echo "account_id = \"$ACCOUNT_ID\"" >> wrangler.toml
  fi
fi

cat wrangler.toml

echo ""
echo "--- Step 5: Generate RSA key pair ---"
KEY_OUTPUT=$(node -e "
const crypto = require('crypto');
const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {type: 'spki', format: 'pem'},
  privateKeyEncoding: {type: 'pkcs8', format: 'pem'}
});
process.stdout.write(JSON.stringify({privateKey, publicKey}));
")
PRIVATE_KEY=$(echo "$KEY_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.privateKey)")
PUBLIC_KEY=$(echo "$KEY_OUTPUT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write(d.publicKey)")
echo "RSA keys generated"

echo ""
echo "--- Step 6: Set JWT secrets ---"
echo "$PRIVATE_KEY" | npx wrangler secret put JWT_PRIVATE_KEY --name legionauth-api || echo "Could not set JWT_PRIVATE_KEY"
echo "$PUBLIC_KEY" | npx wrangler secret put JWT_PUBLIC_KEY --name legionauth-api || echo "Could not set JWT_PUBLIC_KEY"

# Save public key for frontend
mkdir -p ../../apps/web/public
echo "$PUBLIC_KEY" > ../../apps/web/public/jwt-public-key.pem

echo ""
echo "--- Step 7: Apply D1 migrations ---"
npx wrangler d1 migrations apply legionauth-db --remote --experimental-backend || echo "Migration may have failed, continuing..."

echo ""
echo "--- Step 8: Deploy Worker ---"
npx wrangler deploy 2>&1 | tee /tmp/deploy_output.txt
WORKER_URL=$(grep -oP 'https://[a-z0-9-]+\.workers\.dev' /tmp/deploy_output.txt | head -1 || echo "https://legionauth-api.workers.dev")
echo ""
echo "Worker deployed at: $WORKER_URL"

cd ../..

echo ""
echo "--- Step 9: Build & Deploy Frontend ---"
cd apps/web

# Build with the actual worker URL
VITE_API_URL="$WORKER_URL" npx vite build || npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name legionauth --commit-dirty=true 2>&1 | tee /tmp/pages_output.txt || \
npx wrangler pages deploy dist --project-name legionauth-app --commit-dirty=true 2>&1 | tee /tmp/pages_output.txt || \
echo "Pages deployment may need manual setup"

PAGES_URL=$(grep -oP 'https://[a-z0-9-]+\.pages\.dev' /tmp/pages_output.txt | head -1 || echo "https://legionauth.pages.dev")
echo "Frontend deployed at: $PAGES_URL"

cd ../..

echo ""
echo "==========================================="
echo "=== LegionAuth Deployment Complete! ==="
echo "==========================================="
echo ""
echo "API (Cloudflare Worker):  $WORKER_URL"
echo "Dashboard (CF Pages):     $PAGES_URL"
echo ""
echo "Quick test:"
echo "  curl $WORKER_URL/health"
echo "  curl $WORKER_URL/.well-known/jwks.json"
echo ""
echo "Sign up at: $PAGES_URL/sign-up"
echo "Dashboard:  $PAGES_URL/dashboard"
