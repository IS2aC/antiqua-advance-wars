# --- Étape 1 : build ---
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/game/package.json apps/game/
COPY apps/site/package.json apps/site/
COPY tools/asset-pipeline/package.json tools/asset-pipeline/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @antiqua/game build

# --- Étape 2 : service statique ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/game/dist /usr/share/nginx/html
EXPOSE 80
