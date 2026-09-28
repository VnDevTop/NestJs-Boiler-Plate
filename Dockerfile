# Build stage: dev dependencies and the compiler are needed here, and only here.
FROM node:24-alpine AS build
WORKDIR /app

# Match the npm version in package.json#packageManager (npm 11, shipped with
# Node 24) so the image and local installs produce the same lockfile.
RUN npm install -g npm@11

# There is no git repository in the image, so the husky prepare hook must not run.
ENV HUSKY=0

# Copied on their own so a source-only change does not reinstall every dependency.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
# types/env.d.ts is part of the build: tsconfig.build.json includes it.
COPY types ./types
COPY src ./src

RUN npm run build

# Production dependencies only, installed against the built output.
RUN npm ci --omit=dev --ignore-scripts

# Runtime stage: no compiler, no dev dependencies, no source.
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# The base image ships a node user, so the app does not run as root.
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

EXPOSE 3000

# The liveness probe deliberately touches nothing external, so a database
# problem cannot make the container look dead and get it restarted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `node` as PID 1 does not forward signals on its own, which would cut a
# graceful shutdown short, so init handles that.
CMD ["node", "dist/main.js"]
