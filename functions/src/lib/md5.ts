import { createHash } from "node:crypto";

/**
 * Generate an md5 hex digest for a given string.
 * Using Node's native crypto to avoid ts-md5 packaging (ESM/CJS) issues.
 */
export function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}
