#!/bin/bash
set -e

COMPOSE_FILE="$(cd "$(dirname "$0")" && pwd)/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" run --rm openclaw-gc-test bash -c '
# Fix package.json inside container
cat > /root/.openclaw/plugins/openclaw-gc/package.json << PKGJSON
{
  "name": "@openclaw-gc/plugin",
  "version": "0.1.0",
  "description": "OpenClaw GC plugin",
  "main": "index.js",
  "type": "module",
  "openclaw": {
    "id": "openclaw-gc",
    "name": "OpenClaw GC",
    "description": "Garbage collector and guardrails for AI agents",
    "extensions": ["./index.js"]
  }
}
PKGJSON

echo "=== Setup ==="
openclaw setup 2>&1

echo ""
echo "=== Configure OpenAI model ==="
openclaw config set agents.defaults.model openai/gpt-4o 2>&1
cat > /root/.openclaw/agents/main/agent/auth-profiles.json << AUTHEOF
{
  "openai": {
    "apiKey": "$OPENAI_API_KEY"
  }
}
AUTHEOF
echo "Auth configured for OpenAI"

echo ""
echo "=== Install plugin ==="
openclaw plugins install /root/.openclaw/plugins/openclaw-gc 2>&1

echo ""
echo "=== Start gateway ==="
openclaw gateway --port 18789 &
sleep 5

echo ""
echo "=== Send agent task ==="
openclaw agent --agent main --message "Create a Node.js REST API with Express in /root/workspace/api-project. Include routes, middleware, tests, and docs." 2>&1

echo ""
echo "=== GC Status ==="
node /app/dist/cli/index.js status

echo ""
echo "=== Workspace contents ==="
find /root/workspace -type f 2>/dev/null | head -30

echo ""
echo "=== GC Scan ==="
node /app/dist/cli/index.js scan

echo ""
echo "=== Done ==="
'
