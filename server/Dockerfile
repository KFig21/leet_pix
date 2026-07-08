# Multi-stage build for the API. Run from repo root: docker build -f server/Dockerfile .
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install deps using the workspace manifests for cache efficiency.
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY server server

RUN npm run db:generate -w server
RUN npm run build -w server

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
