export function parseAdvancedJson(text: string): Record<string, unknown> {
  if (!text.trim()) {
    return {};
  }

  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Advanced JSON Params is not valid JSON.");
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Advanced JSON Params must be a JSON object.");
  }

  return value as Record<string, unknown>;
}
