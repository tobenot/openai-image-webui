function getFileExtension(imageUrl: string, mimeType?: string): string {
  const type = mimeType || imageUrl.match(/^data:([^;,]+)/)?.[1] || "";

  if (type.includes("jpeg") || imageUrl.startsWith("data:image/jpeg")) {
    return "jpg";
  }

  if (type.includes("webp") || imageUrl.startsWith("data:image/webp")) {
    return "webp";
  }

  return "png";
}

function clickDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadImage(imageUrl: string, filenameBase: string, mimeType?: string) {
  if (imageUrl.startsWith("data:")) {
    clickDownload(imageUrl, `${filenameBase}.${getFileExtension(imageUrl, mimeType)}`);
    return;
  }

  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    clickDownload(objectUrl, `${filenameBase}.${getFileExtension(imageUrl, blob.type || mimeType)}`);
    URL.revokeObjectURL(objectUrl);
  } catch {
    clickDownload(imageUrl, `${filenameBase}.${getFileExtension(imageUrl, mimeType)}`);
  }
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
