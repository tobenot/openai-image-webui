/**
 * Shared request-shaping helpers for every OpenAI-compatible endpoint.
 *
 * Living here rather than in one endpoint module is deliberate: a guard that
 * only exists in `openaiImages.ts` is a guard that the next endpoint will
 * forget to apply.
 */

/**
 * Drops keys starting with `_` from an extraParams object before sending it to
 * the API. Such keys are reserved for internal metadata (e.g. `_batchId`,
 * `_batchIndex`) and must never leak into a request body.
 */
export function stripInternalParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith("_")) {
      out[key] = value;
    }
  }

  return out;
}

export function joinBaseUrl(baseUrl: string, path: string) {
  return `${baseUrl.trim().replace(/\/$/, "")}${path}`;
}
