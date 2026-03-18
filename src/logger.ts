import { createLogger, format, transports } from "winston";
import { mkdirSync } from "node:fs";

let logLevel = "info";
if (process.env.LOG_LEVEL !== undefined) {
  logLevel = process.env.LOG_LEVEL;
}

const logsDirectory = "logs";
mkdirSync(logsDirectory, { recursive: true });

const baseLogger = createLogger({
  level: logLevel,
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console(),
    new transports.File({ filename: `${logsDirectory}/app.log` }),
  ],
});

const normalizePayload = (payload: unknown): Record<string, unknown> & { message: string } => {
  if (typeof payload === "object" && payload !== null) {
    const objectPayload = payload as Record<string, unknown>;
    const message =
      typeof objectPayload.message === "string"
        ? objectPayload.message
        : typeof objectPayload.event === "string"
          ? objectPayload.event
          : "log";
    return { ...objectPayload, message };
  }

  return { message: String(payload) };
};

export const logger = {
  debug(payload: unknown): void {
    baseLogger.log({ level: "debug", ...normalizePayload(payload) });
  },
  info(payload: unknown): void {
    baseLogger.log({ level: "info", ...normalizePayload(payload) });
  },
  warn(payload: unknown): void {
    baseLogger.log({ level: "warn", ...normalizePayload(payload) });
  },
  error(payload: unknown): void {
    baseLogger.log({ level: "error", ...normalizePayload(payload) });
  },
};
