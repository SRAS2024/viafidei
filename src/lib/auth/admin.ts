import { constantTimeEquals } from "../security/hash";
import { getSession } from "./session";

export type AdminPrincipal = {
  username: string;
  signedInAt: number;
};

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  const userOk = constantTimeEquals(username, expectedUser);
  const passOk = constantTimeEquals(password, expectedPass);
  return userOk && passOk;
}

export async function requireAdmin(): Promise<AdminPrincipal | null> {
  const session = await getSession();
  if (session.role !== "ADMIN" || !session.adminSignedInAt) return null;
  return {
    username: session.userEmail ?? process.env.ADMIN_USERNAME ?? "admin",
    signedInAt: session.adminSignedInAt,
  };
}
