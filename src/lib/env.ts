import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().optional(),
  CANONICAL_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  INGESTION_USER_AGENT: z.string().optional(),
  INGESTION_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  INGESTION_INITIAL_STATUS: z.enum(["DRAFT", "REVIEW"]).optional(),
});

const productionSchema = baseSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;
  if (!env.SESSION_SECRET && !env.JWT_ACCESS_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SESSION_SECRET"],
      message:
        "SESSION_SECRET (or JWT_ACCESS_SECRET) must be set to a 32+ char value in production.",
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
  // to keep dev workflows running. Build it explicitly from the looser
  // base schema so missing optional fields stay `undefined` rather than
  // pretending `process.env` already matches the parsed shape.
  const loose = baseSchema.partial().safeParse(process.env);
  const data = loose.success ? loose.data : {};
  return {
    NODE_ENV: data.NODE_ENV ?? "development",
    APP_URL: data.APP_URL,
    CANONICAL_URL: data.CANONICAL_URL,
    DATABASE_URL: data.DATABASE_URL ?? "",
    SESSION_SECRET: data.SESSION_SECRET,
    JWT_ACCESS_SECRET: data.JWT_ACCESS_SECRET,
    ADMIN_USERNAME: data.ADMIN_USERNAME,
    ADMIN_PASSWORD: data.ADMIN_PASSWORD,
    CRON_SECRET: data.CRON_SECRET,
    INGESTION_USER_AGENT: data.INGESTION_USER_AGENT,
    INGESTION_HTTP_TIMEOUT_MS: data.INGESTION_HTTP_TIMEOUT_MS,
    INGESTION_INITIAL_STATUS: data.INGESTION_INITIAL_STATUS,
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
