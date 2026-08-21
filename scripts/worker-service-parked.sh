#!/bin/sh
# Railway Admin Worker service — PARKED.
#
# The Admin Worker's active execution host is the operator's MacBook, launched
# and supervised by the native Via Fidei application (see
# scripts/local-worker-host.ts). This service is deliberately retained as
# deployable infrastructure so cloud execution can be restored in the future —
# but its normal production state must consume essentially no compute:
#
#   - no Node process,
#   - no resident Python intelligence brain,
#   - no Prisma client and no database polling,
#   - no Chromium.
#
# It parks on `sleep`, which holds a few hundred KB of RSS and zero CPU. This is
# the mechanism that makes the footprint negligible: Railway's config schema
# requires numReplicas >= 1, so the service cannot be scaled to zero from
# railway.worker.json. `deploy.sleepApplication: true` additionally asks Railway
# to sleep the idle service.
#
# To deliberately restore cloud execution in the future (there is no automatic
# failover — spec §5), change the service start command to:
#
#   npm run worker -- --force-remote-execution "reason for the change"
#
# and ALSO set `deploy.sleepApplication` to false in railway.worker.json first:
# a worker service receives no inbound traffic, so with app-sleep enabled a
# restored worker would be slept during any idle or backoff window and nothing
# would ever wake it.
#
# and make sure the local worker is switched OFF first, so only one runtime
# holds the execution lease.
set -eu

echo "viafidei worker service: PARKED."
echo "The Admin Worker executes on the operator's MacBook via the Via Fidei application."
echo "This container intentionally runs no worker, no Python brain and no browser."
echo "See README - Admin Worker execution host - for how to restore cloud execution."

# `sleep infinity` is not portable to every BusyBox build; loop on a long sleep.
while true; do
  sleep 86400
done
