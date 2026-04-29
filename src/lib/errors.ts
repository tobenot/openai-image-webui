export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error.";
}

export function toFriendlyError(error: unknown): string {
  const message = getErrorMessage(error);

  if (message === "Failed to fetch") {
    return "Request failed. Please check your API key, base URL, model, network, or CORS settings.";
  }

  return message;
}
