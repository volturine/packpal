# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json svelte.config.js tsconfig.json vite.config.ts ./
RUN npm ci --ignore-scripts

COPY . .

RUN npm run prepare \
	&& npm run build \
	&& npm prune --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATABASE_PATH=/data/packpal.db

WORKDIR /app

COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json

RUN mkdir -p /data \
	&& chown node:node /data

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3000}/`).then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"]

USER node
CMD ["node", "build/index.js"]
