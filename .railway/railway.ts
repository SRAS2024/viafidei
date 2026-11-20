import { defineRailway, github, preserve, project, service } from "railway/iac";

// How Railway builds and starts Via Fidei (project feisty-success). This file
// replaces railway.json and railway.worker.json: Railway stops reading those
// Config as Code files on 2026-12-01.
//
// Railway never reads this file during a deploy. `railway config apply` copies
// these settings onto the services, and every later deploy uses them. Editing
// this file changes nothing until someone applies it: read .railway/README.md
// first.
//
// A named partial: the file manages only the two services it declares. The
// Postgres database and its volume are not listed and are never touched. A file
// without a partial would manage the whole project, and an apply would then
// delete every service or database it does not list.
//
// Inside a declared service, leaving something out also means "remove it". So
// each service names its GitHub source and every variable it has on Railway.
// preserve() keeps a variable's value exactly as Railway stores it; no value
// is ever written here.
export const partial = "viafidei";

export default defineRailway(() => {
  // The web app at https://etviafidei.com. scripts/start.sh waits for the
  // database, runs `prisma migrate deploy` and validates the schema before the
  // server starts.
  const web = service("viafidei", {
    source: github("SRAS2024/viafidei", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    deploy: {
      startCommand: "./scripts/start.sh",
      healthcheckPath: "/api/health/live",
      healthcheckTimeout: 180,
      // Restarted on failure: Railway's default restart policy. Railway does
      // not store a default, so restartPolicyType: "ON_FAILURE" written here
      // would show as a change in every plan.
      restartPolicyMaxRetries: 5,
    },
    env: {
      ADMIN_EMAIL: preserve(),
      ADMIN_PASSWORD: preserve(),
      ADMIN_USERNAME: preserve(),
      ADMIN_WORKER_OPEN_INTERNET: preserve(),
      DATABASE_URL: preserve(),
      RESEND_API_KEY: preserve(),
      SESSION_SECRET: preserve(),
    },
  });

  // The retained Admin Worker service, parked: the worker runs on the
  // operator's Mac. scripts/worker-service-parked.sh only sleeps, and Railway
  // sleeps the idle service. To restore cloud execution, read the comments in
  // that script first.
  const worker = service("joyful-upliftment", {
    source: github("SRAS2024/viafidei", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile.worker",
    },
    deploy: {
      startCommand: "sh scripts/worker-service-parked.sh",
      sleepApplication: true,
      // Restarted on failure, Railway's default (see the web service above).
      restartPolicyMaxRetries: 5,
    },
    env: {
      ADMIN_EMAIL: preserve(),
      ADMIN_PASSWORD: preserve(),
      ADMIN_USERNAME: preserve(),
      ADMIN_WORKER_OPEN_INTERNET: preserve(),
      DATABASE_URL: preserve(),
      RESEND_API_KEY: preserve(),
      SESSION_SECRET: preserve(),
    },
  });

  return project("feisty-success", {
    resources: [web, worker],
  });
});
