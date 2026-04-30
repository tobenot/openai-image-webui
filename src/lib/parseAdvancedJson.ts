interface AdvancedJsonMessages {
  invalidJson: string;
  mustBeObject: string;
}

const DEFAULT_ADVANCED_JSON_MESSAGES: AdvancedJsonMessages = {
  invalidJson: "Advanced JSON Params is not valid JSON.",
  mustBeObject: "Advanced JSON Params must be a JSON object.",
};

export function parseAdvancedJson(
  text: string,
  messages: AdvancedJsonMessages = DEFAULT_ADVANCED_JSON_MESSAGES,
): Record<string, unknown> {
  if (!text.trim()) {
    return {};
  }

  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(messages.invalidJson);
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(messages.mustBeObject);
  }

  return value as Record<string, unknown>;
}

