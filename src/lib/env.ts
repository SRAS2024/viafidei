import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

// Treat empty strings as undefined. The shipped .env.example lists the only
// required variables non-empty; without this preprocessing, zod validates an
// empty string against the inner type (e.g. `.url()`) and rejects it.
const optionalString = (inner: z.ZodTypeAny) =>
  z.preprocess((v) => (v === "" ? undefined : v), inner.optional());

// Only four secrets / deploy-specific values are environment variables.
// Everything else lives in `src/lib/config.ts` as hardcoded defaults so
// production deployments do not have to configure anything beyond the
// minimum needed to bring the database online and protect the admin login.
const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: optionalString(z.string().min(32)),
  ADMIN_USERNAME: optionalString(z.string().min(1)),
  ADMIN_PASSWORD: optionalString(z.string().min(12)),
  // Optional: when set, the app will attempt to deliver transactional email
  // through Resend. When unset, email features (welcome, password reset,
  // verification) are safely disabled and never throw.
  RESEND_API_KEY: optionalString(z.string().min(1)),
});

const productionSchema = baseSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;
  if (!env.SESSION_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SESSION_SECRET"],
      message: "SESSION_SECRET must be set to a 32+ char value in production.",
    });
  }
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ADMIN_USERNAME"],
      message: "ADMIN_USERNAME and ADMIN_PASSWORD must be set in production.",
    });
  }
});

export type Env = z.infer<typeof baseSchema>;

let cached: Env | null = null;

function fallbackEnvFromProcess(): Env {
  // In non-production, when validation fails we still need a typed object
  // so dev workflows keep running. Build it explicitly from the looser base
  // schema so missing optional fields stay `undefined`.
  const loose = baseSchema.partial().safeParse(process.env);
  const data = loose.success ? loose.data : {};
  return {
    NODE_ENV: data.NODE_ENV ?? "development",
    DATABASE_URL: data.DATABASE_URL ?? "",
    SESSION_SECRET: data.SESSION_SECRET,
    ADMIN_USERNAME: data.ADMIN_USERNAME,
    ADMIN_PASSWORD: data.ADMIN_PASSWORD,
    RESEND_API_KEY: data.RESEND_API_KEY,
  };
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = productionSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    const message = `Invalid environment configuration:\n${formatted}`;
    if (isProd) {
      throw new Error(message);
    }
    console.warn(`[env] ${message}`);
  }
  cached = parsed.success ? parsed.data : fallbackEnvFromProcess();
  return cached;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}
