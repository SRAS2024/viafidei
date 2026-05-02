type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredMinLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const minPriority = LEVEL_PRIORITY[configuredMinLevel()];

export type LogFields = Record<string, unknown>;

function serializeError(value: unknown): LogFields {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return { value };
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  if (LEVEL_PRIORITY[level] < minPriority) return;
  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...fields,
  };
  if (fields?.error !== undefined) {
    entry.error = serializeError(fields.error);
  }
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    emit("debug", message, fields);
  },
  info(message: string, fields?: LogFields): void {
    emit("info", message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    emit("warn", message, fields);
  },
  error(message: string, fields?: LogFields): void {
    emit("error", message, fields);
  },
  child(bindings: LogFields) {
    return {
      debug: (msg: string, f?: LogFields) => emit("debug", msg, { ...bindings, ...f }),
      info: (msg: string, f?: LogFields) => emit("info", msg, { ...bindings, ...f }),
      warn: (msg: string, f?: LogFields) => emit("warn", msg, { ...bindings, ...f }),
      error: (msg: string, f?: LogFields) => emit("error", msg, { ...bindings, ...f }),
    };
  },
};

export type Logger = typeof logger;
