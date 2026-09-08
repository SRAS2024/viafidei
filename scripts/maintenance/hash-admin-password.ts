#!/usr/bin/env tsx
/**
 * Print an Argon2id hash of the administrator password, for ADMIN_PASSWORD.
 *
 * Why: ADMIN_PASSWORD used to hold the password in the clear, so anyone who
 * could read the deployment's environment could sign in as the administrator.
 * src/lib/auth/password.ts now accepts either form — an Argon2 PHC string is
 * verified directly, plaintext is still honoured for backward compatibility —
 * so moving to a hash removes the reusable secret without a redeploy dance and
 * without a second variable.
 *
 * The password is read from a hidden prompt (or piped stdin), never from a
 * command-line argument: argv lands in shell history and is visible to every
 * other process on the machine via `ps`.
 *
 * Usage:
 *   npx tsx scripts/maintenance/hash-admin-password.ts
 *   printf '%s' "$PW" | npx tsx scripts/maintenance/hash-admin-password.ts --stdin
 *
 * You keep typing the SAME password at the admin login. Only the stored
 * representation changes.
 */
import { createInterface } from "node:readline";

import { hashPassword, isPasswordHash, verifyPassword } from "../../src/lib/auth/password";

/** Read a line without echoing it, so the password never appears on screen. */
function readSecret(prompt: string): Promise<string> {
  if (process.argv.includes("--stdin") || !process.stdin.isTTY) {
    return new Promise((resolve) => {
      let buf = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (buf += c));
      process.stdin.on("end", () => resolve(buf.replace(/\r?\n$/, "")));
    });
  }
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = process.stdout as NodeJS.WriteStream & { _writeToOutput?: (s: string) => void };
    // readline echoes by default; swallow everything after the prompt itself.
    out._writeToOutput = function (s: string) {
      if (s.startsWith(prompt)) out.write(prompt);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const password = await readSecret("Administrator password (input hidden): ");

  if (password.length === 0) throw new Error("no password supplied");
  if (isPasswordHash(password)) {
    throw new Error("that is already an Argon2 hash — paste the PASSWORD, not the hash");
  }
  // env.ts requires ADMIN_PASSWORD to be at least 12 characters. Catch it here
  // rather than at the next deploy, where a bad value fails the container.
  if (password.length < 12) {
    throw new Error(
      `password is ${password.length} characters; ADMIN_PASSWORD requires 12 or more`,
    );
  }

  const hash = await hashPassword(password);
  // Never hand over a hash that does not verify — a typo here locks the
  // administrator out of production.
  if (!(await verifyPassword(hash, password))) {
    throw new Error("internal error: generated hash did not verify; nothing was printed");
  }

  process.stdout.write(`\nADMIN_PASSWORD=${hash}\n\n`);
  process.stdout.write("Set that as ADMIN_PASSWORD on the WEB service. Keep signing in with the\n");
  process.stdout.write("same password you just typed — only the stored form changed.\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
