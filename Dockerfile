FROM node:24-alpine AS base

FROM base AS deps

WORKDIR /app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install

FROM base AS builder

WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/ .
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN apk add --no-cache tzdata

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/server ./.next/server

EXPOSE 3000

CMD ["node", "server.js"]
