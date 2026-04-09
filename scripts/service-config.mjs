export const FIXED_PORT = 26007;
export const FIXED_HOST = "0.0.0.0";
export const LOG_DIR = "logs";
export const LOG_FILE = "service-startup.log";
export const DEFAULT_PORT_CONFLICT_POLICY = "exit";

export function normalizePortConflictPolicy(value) {
  if (!value) {
    return DEFAULT_PORT_CONFLICT_POLICY;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "kill") {
    return "kill";
  }
  return "exit";
}
