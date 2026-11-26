# Alkébulan — serveur des comptes et de la présence (Fastify + PostgreSQL).
# Build depuis la racine du dépôt : docker build -f apps/server/Dockerfile .
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY patches patches
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/game/package.json apps/game/
COPY apps/site/package.json apps/site/
COPY apps/server/package.json apps/server/
COPY tools/asset-pipeline/package.json tools/asset-pipeline/
COPY tools/cli/package.json tools/cli/
RUN pnpm install --frozen-lockfile --prod --filter "@antiqua/server..."

# Le moteur sera utilisé pour arbitrer les parties en ligne.
COPY packages/engine packages/engine
COPY packages/protocol packages/protocol
COPY apps/server apps/server

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
WORKDIR /app/apps/server
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/sante || exit 1
CMD ["node_modules/.bin/tsx", "src/main.ts"]
