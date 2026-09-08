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
 *   npx tsx scripts/maintenance/hash-admin-password.ts --generate
 *   printf '%s' "$PW" | npx tsx scripts/maintenance/hash-admin-password.ts --stdin
 *
 *   --generate   invent a new strong password instead of prompting for one.
 *                The new password is written to the output file too, because
 *                you cannot sign in with a hash — you need the plaintext once,
 *                to put in your password manager.
 *   --out PATH   where to write the result (default: the Desktop). The file is
 *                created 0600 and the script tells you to delete it.
 *
 * Terminal output is easy to miss or lose to scrollback, so the result is
 * ALWAYS written to a file as well.
 *
 * You keep typing the SAME password at the admin login unless you passed
 * --generate. Only the stored representation changes.
 */
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

import { hashPassword, isPasswordHash, verifyPassword } from "../../src/lib/auth/password";

/**
 * A 24-character password from an unambiguous alphabet — no O/0, l/1/I — so it
 * survives being read aloud or retyped from a screen. randomInt is CSPRNG-backed
 * and rejection-samples internally, so there is no modulo bias.
 */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_";
  let out = "";
  for (let i = 0; i < 24; i += 1) out += alphabet[randomInt(alphabet.length)];
  return out;
}

function outputPath(): string {
  const i = process.argv.indexOf("--out");
  if (i !== -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]!);
  return path.join(homedir(), "Desktop", "viafidei-admin-password.txt");
}

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
  const generated = process.argv.includes("--generate");
  const password = generated
    ? generatePassword()
    : await readSecret("Administrator password (input hidden): ");

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

  const target = outputPath();
  const lines = [
    "Via Fidei — administrator credential",
    "====================================",
    "",
    "Set this ONE variable on the Railway WEB service (viafidei).",
    "There is no new variable: ADMIN_PASSWORD already exists, and only its",
    "stored form changes. Do NOT set it on the Postgres service.",
    "",
    "Variable name:",
    "",
    "ADMIN_PASSWORD",
    "",
    "Variable value (copy the whole line, including the leading $):",
    "",
    hash,
    "",
  ];
  if (generated) {
    lines.push(
      "This password was newly generated. Save it in your password manager NOW —",
      "it is the only copy, it cannot be recovered from the hash above, and you",
      "sign in with THIS, not with the hash:",
      "",
      password,
      "",
    );
  } else {
    lines.push(
      "Keep signing in with the same password you typed. Only the stored form changed.",
      "",
    );
  }
  lines.push(
    "When you have pasted the value into Railway, DELETE THIS FILE.",
    `    rm ${JSON.stringify(target)}`,
    "",
  );
  // 0600: readable only by this user. A Desktop file is convenient, not safe.
  writeFileSync(target, lines.join("\n"), { encoding: "utf8", mode: 0o600 });

  process.stdout.write(`\nADMIN_PASSWORD=${hash}\n\n`);
  process.stdout.write(`Written to: ${target}\n`);
  process.stdout.write("Paste the value into Railway, then delete that file.\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
