// Shares a PNG data URL via the iOS share sheet (which includes Save to Photos)
// on the native shell, or the Web Share API / download on the web.
import { Capacitor } from "@capacitor/core";

export function canShare(): boolean {
  return (
    Capacitor.isNativePlatform() ||
    (typeof navigator !== "undefined" && typeof navigator.share === "function")
  );
}

export async function shareCardImage(
  dataUrl: string,
  filename = "elsewhere-number.png"
): Promise<void> {
  const base64 = dataUrl.split(",")[1] ?? "";

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ files: [uri], dialogTitle: "Share your number" });
    return;
  }

  // Web: prefer native share with the file, else fall back to a download.
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Elsewhere" });
    return;
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
