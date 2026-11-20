# Railway configuration

`railway.ts` says how Railway builds and starts Via Fidei's two services
(project feisty-success, environment production):

- `viafidei`, the web app: built from `Dockerfile`, started with
  `./scripts/start.sh` (database migrations run before the server starts),
  health check `/api/health/live` with 180 seconds to pass, restarted on
  failure up to 5 times.
- `joyful-upliftment`, the parked Admin Worker: built from `Dockerfile.worker`,
  started with `sh scripts/worker-service-parked.sh`, slept by Railway while
  idle, restarted on failure up to 5 times.

It replaced `railway.json` and `railway.worker.json` (Config as Code), which
Railway stops reading on 2026-12-01.

## Railway does not read this file during a deploy

`railway config apply` copies these settings onto the services, and every later
deploy uses them. Editing the file alone changes nothing. Pushing to `main`
still deploys both services, with whatever settings were last applied.

## Changing a setting

1. Install Railway's TypeScript SDK, once per checkout. It lives only in this
   folder, never in the app: `npm ci --prefix .railway`
2. Edit `railway.ts`.
3. From the repository root, run `railway config plan` and read every line.
4. Run `railway config apply` only if the plan lists exactly your change and
   nothing marked Delete or destroy. An apply can redeploy the service it
   changes.

## Two rules that keep an apply safe

- Keep `export const partial = "viafidei"`. Without it the file manages the
  whole project, and an apply deletes every service or database it does not
  list, the Postgres database among them.
- Inside a declared service, leaving something out means "remove it". Each
  service names its GitHub source and every variable it has on Railway. A
  variable added in the dashboard must be added to `env` as `preserve()` before
  the next apply, or that apply deletes it. `preserve()` keeps the value on
  Railway; no value is ever written here.

`tests/admin-worker/railway-worker-service-parked.test.ts` checks the parked
worker's settings, the partial and both services' GitHub source.
