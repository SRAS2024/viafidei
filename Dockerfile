# syntax=docker/dockerfile:1.6

# ---------- deps stage ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=development
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- build stage ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# npm run build already runs "prisma generate && next build" via the build script,
# using the local prisma@5.x from node_modules — no separate generate step needed.
RUN npm run build

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --chown=nextjs:nodejs scripts/start.sh scripts/validate-db.js ./scripts/
RUN chmod +x ./scripts/start.sh ./scripts/validate-db.js

USER nextjs
EXPOSE 3000
# Hits /api/health/live so the container's healthcheck stays green while a
# transient database issue would only flip /api/health (the readiness probe).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1

# scripts/start.sh: waits for the DB, runs migrate deploy (FAIL-FAST: the
# container exits non-zero if migrations fail), then runs scripts/validate-db.js
# to confirm tables/columns/migration history are intact, then execs the
# standalone server so Node owns PID 1 and signals propagate cleanly.
CMD ["./scripts/start.sh"]
