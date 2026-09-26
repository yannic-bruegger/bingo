FROM node:22-alpine AS base
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── Runner ───────────────────────────────────────────────────────────────────
# server.ts runs through tsx and starts Next programmatically, so the runner
# needs the full node_modules and the sources next to the build output.
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json /app/tsconfig.json /app/next.config.ts /app/server.ts ./
COPY --from=builder /app/src ./src

USER node
EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server.ts"]
