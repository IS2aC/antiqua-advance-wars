# Alkébulan — image de production : le jeu est un site statique servi par Nginx.
# Aucun serveur applicatif au Stage 1 (sauvegarde dans le navigateur).

# --- Étape 1 : build ---
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Manifestes d'abord (cache Docker des dépendances) : tous les paquets du workspace,
# sinon l'installation verrouillée par le lockfile échoue.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/game/package.json apps/game/
COPY apps/site/package.json apps/site/
COPY tools/asset-pipeline/package.json tools/asset-pipeline/
COPY tools/cli/package.json tools/cli/

# Seulement le jeu et ses dépendances (moteur, Phaser, Vite) : pas d'Astro ni de sharp.
RUN pnpm install --frozen-lockfile --filter "@antiqua/game..."

COPY packages/engine packages/engine
COPY apps/game apps/game
RUN pnpm --filter @antiqua/game build

# --- Étape 2 : service statique ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/game/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
