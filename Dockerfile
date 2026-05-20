# syntax=docker/dockerfile:1.6

# openssl/libssl source. node:22-bookworm-slim ships without openssl, which
# the Prisma query engine needs at runtime; apt-get installing it broke
# deploys during Debian-mirror signature outages. buildpack-deps:bookworm-curl
# is the same Debian release (so its libraries are binary-compatible) and is
# small — later stages COPY the libraries from here instead of using apt.
FROM buildpack-deps:bookworm-curl AS osslibs

# ---------- deps stage ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- build stage ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# libssl/libcrypto so `prisma generate` detects OpenSSL 3.x.
COPY --from=osslibs /usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/x86_64-linux-gnu/libcrypto.so.3 /usr/lib/x86_64-linux-gnu/
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# npm run build already runs "prisma generate && next build" via the build script,
# using the local prisma@5.x from node_modules — no separate generate step needed.
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# openssl runtime: the Prisma query engine links libssl/libcrypto, and its
# Postgres TLS reads the CA bundle under /etc/ssl — node:slim has neither.
COPY --from=osslibs /usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/x86_64-linux-gnu/libcrypto.so.3 /usr/lib/x86_64-linux-gnu/
COPY --from=osslibs /etc/ssl/ /etc/ssl/
COPY --from=osslibs /usr/lib/ssl/ /usr/lib/ssl/
COPY --from=osslibs /usr/share/ca-certificates/ /usr/share/ca-certificates/
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# argon2 ships native bindings under ./prebuilds and resolves them at runtime
# through node-gyp-build, which the Next.js standalone tracer (NFT) does not
# follow. next.config.js explicitly traces these in via
# outputFileTracingIncludes; this redundant copy is a belt-and-suspenders
# safety net in case the trace ever drops the prebuild directory.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/argon2 ./node_modules/argon2
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
