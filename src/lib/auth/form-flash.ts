import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "./session";

/**
 * What the reader typed into a form that failed on the server.
 *
 * Log in and create account are real form posts, which is what password managers
 * expect and what works without script, so a failure comes back as a redirect and a
 * fresh page. Forgot password is one too when it is pressed before its script has run.
 * Without this the reader types everything again, which is a real cost when every field
 * is read out one at a time. Names and addresses do not belong in a URL, where they reach
 * the browser's history, server logs and the Referer header, so they travel in a sealed,
 * http-only cookie that lasts a minute and is sent only to the form's own page. Passwords
 * never come near it.
 */
const FORM_FLASH_COOKIE = "vf_form_flash";
const FORM_FLASH_TTL_SECONDS = 60;

export type FormFlashPath = "/login" | "/register" | "/forgot-password";

/** The non-secret fields a form may get back, with the longest its schema allows. */
const KEPT_FIELD_LIMITS = { email: 200, firstName: 80, lastName: 80 } as const;

export type KeptFields = Partial<Record<keyof typeof KEPT_FIELD_LIMITS, string>>;

function keptFrom(fields: Partial<Record<keyof KeptFields, unknown>>): KeptFields {
  const kept: KeptFields = {};
  for (const name of Object.keys(KEPT_FIELD_LIMITS) as Array<keyof KeptFields>) {
    const value = fields[name];
    if (typeof value === "string" && value.length > 0) {
      kept[name] = value.slice(0, KEPT_FIELD_LIMITS[name]);
    }
  }
  return kept;
}

function flashCookieOptions(path: FormFlashPath, maxAge: number) {
  return {
    path,
    maxAge,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/** Called on the way back to a form. A convenience never stands in the way of the redirect. */
export async function keepFormFields(
  path: FormFlashPath,
  fields: Partial<Record<keyof KeptFields, unknown>>,
): Promise<void> {
  try {
    const kept = keptFrom(fields);
    if (Object.keys(kept).length === 0) return;
    const sealed = await sealData(kept, {
      password: sessionOptions.password,
      ttl: FORM_FLASH_TTL_SECONDS,
    });
    const jar = await cookies();
    jar.set(FORM_FLASH_COOKIE, sealed, flashCookieOptions(path, FORM_FLASH_TTL_SECONDS));
  } catch {
    // The reader only has to type the fields again.
  }
}

/**
 * Read by the form's page after a failure. A page cannot clear a cookie while it renders,
 * so the cookie's own minute is what ends it, and a successful attempt clears it sooner.
 */
export async function readKeptFields(): Promise<KeptFields> {
  try {
    const jar = await cookies();
    const sealed = jar.get(FORM_FLASH_COOKIE)?.value;
    if (!sealed) return {};
    const fields = await unsealData<Partial<Record<keyof KeptFields, unknown>>>(sealed, {
      password: sessionOptions.password,
      ttl: FORM_FLASH_TTL_SECONDS,
    });
    return keptFrom(fields);
  } catch {
    return {};
  }
}

/** Called once the form has succeeded: nothing typed outlives its purpose. */
export async function clearKeptFields(path: FormFlashPath): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(FORM_FLASH_COOKIE, "", flashCookieOptions(path, 0));
  } catch {
    // It expires on its own within the minute.
  }
}
