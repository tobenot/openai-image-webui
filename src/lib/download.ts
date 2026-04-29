function getFileExtension(imageUrl: string): string {
  if (imageUrl.startsWith("data:image/jpeg")) {
    return "jpg";
  }

  if (imageUrl.startsWith("data:image/webp")) {
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

export async function downloadImage(imageUrl: string, filenameBase: string) {
  const filename = `${filenameBase}.${getFileExtension(imageUrl)}`;

  if (imageUrl.startsWith("data:")) {
    clickDownload(imageUrl, filename);
    return;
  }

  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    clickDownload(objectUrl, filename);
    URL.revokeObjectURL(objectUrl);
  } catch {
    clickDownload(imageUrl, filename);
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
