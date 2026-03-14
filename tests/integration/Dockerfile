FROM node:24-slim

RUN apt-get update && apt-get install -y git python3 make g++ curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install OpenClaw globally
RUN npm install -g openclaw@latest

# 2. Copy and build our GC
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
COPY tests/ ./tests/
RUN npm ci && npm run build

# 3. Install GC plugin into OpenClaw's plugin directory
RUN mkdir -p /root/.openclaw/plugins/openclaw-gc && \
    cp -r dist/plugin/* /root/.openclaw/plugins/openclaw-gc/ && \
    cp -r dist/core /root/.openclaw/plugins/openclaw-gc/ && \
    cp src/plugin/package.json /root/.openclaw/plugins/openclaw-gc/package.json && \
    cp src/plugin/openclaw.plugin.json /root/.openclaw/plugins/openclaw-gc/openclaw.plugin.json && \
    cp -r node_modules /root/.openclaw/plugins/openclaw-gc/node_modules

# 4. Configure GC
RUN mkdir -p /root/.openclaw-gc && \
    echo '{ \
      "allowedPaths": ["/tmp", "/app", "/root/workspace"], \
      "protectedPaths": ["~/.ssh", "~/.aws", "~/.zshrc", "~/.bashrc", "~/.gitconfig", "~/.env"], \
      "maxFilesPerMinute": 30, \
      "maxDirDepth": 10, \
      "autoCleanPatterns": ["**/.tmp-*", "**/tmp-openclaw-*", "**/.openclaw-tmp-*"], \
      "journalRetentionDays": 30, \
      "dryRun": false, \
      "apiPort": 18790 \
    }' > /root/.openclaw-gc/config.json

# 5. Workspace for agents
RUN mkdir -p /root/workspace

CMD ["bash"]
