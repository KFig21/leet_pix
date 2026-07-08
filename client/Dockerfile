# Build the SPA and serve it statically. Run from repo root.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY client/package.json client/
RUN npm install
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY client client
RUN npm run build -w client

FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
