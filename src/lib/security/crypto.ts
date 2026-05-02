import crypto from "node:crypto";
import { deriveKey } from "./keys";

const PAYLOAD_VERSION = "v1";

export function encryptAtRest(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PAYLOAD_VERSION}.${iv.toString("base64url")}.${authTag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptAtRest(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== PAYLOAD_VERSION || !ivB64 || !tagB64 || !ctB64) {
    throw new Error("Invalid encrypted payload");
  }
  const key = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
