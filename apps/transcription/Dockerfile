FROM node:20-alpine AS builder
WORKDIR /app
ENV npm_config_ignore_scripts=true

RUN npm install -g pnpm@8

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY apps/transcription/package.json apps/transcription/tsconfig.json apps/transcription/
COPY packages/schema/src packages/schema/src

RUN pnpm install --frozen-lockfile --ignore-scripts --filter @repo/transcription...

COPY apps/transcription/src apps/transcription/src
RUN pnpm --filter @repo/transcription build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV npm_config_ignore_scripts=true

RUN npm install -g pnpm@8
RUN apk add --no-cache ffmpeg

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/transcription/package.json apps/transcription/

RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @repo/transcription...

COPY --from=builder /app/apps/transcription/dist apps/transcription/dist

EXPOSE 8788
WORKDIR /app/apps/transcription

CMD ["node", "dist/index.js", "serve", "--api-url", "http://api:3000", "--host", "0.0.0.0", "--port", "8788"]
