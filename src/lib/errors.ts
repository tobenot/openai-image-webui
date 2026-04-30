interface FriendlyErrorMessages {
  unknown: string;
  requestFailed: string;
}

const DEFAULT_FRIENDLY_ERROR_MESSAGES: FriendlyErrorMessages = {
  unknown: "Unknown error.",
  requestFailed: "Request failed. Please check your API key, base URL, model, network, or CORS settings.",
};

export function getErrorMessage(
  error: unknown,
  messages: Pick<FriendlyErrorMessages, "unknown"> = DEFAULT_FRIENDLY_ERROR_MESSAGES,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return messages.unknown;
}

export function toFriendlyError(
  error: unknown,
  messages: FriendlyErrorMessages = DEFAULT_FRIENDLY_ERROR_MESSAGES,
): string {
  const message = getErrorMessage(error, messages);

  if (message === "Failed to fetch") {
    return messages.requestFailed;
  }

  return message;
}

