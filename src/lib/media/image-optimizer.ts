/**
 * Browser-side image optimizer used before profile photos are uploaded.
 *
 * Profile photos are rendered in a small circular frame, so the
 * full-resolution camera/phone image (often 4–10 MB) is wildly over-sized
 * for the use case. This module loads the file into a canvas, resizes it
 * down to a square crop sized for retina-quality circular display, and
 * re-encodes it as JPEG so the persisted data URL stays small.
 *
 * The result keeps the photo crisp on a high-DPI screen while keeping the
 * stored payload around 30–80 KB instead of multiple megabytes.
 */

export type OptimizeImageOptions = {
  /** Final square output edge in pixels (defaults to 512). */
  maxEdge?: number;
  /** JPEG quality in [0, 1] (defaults to 0.85). */
  quality?: number;
  /** Output mime type — JPEG works best for photos because of compression. */
  mimeType?: "image/jpeg" | "image/webp";
  /** Optional cap on the encoded payload size (bytes). */
  maxBytes?: number;
};

export type OptimizedImage = {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  mimeType: string;
};

const DEFAULT_MAX_EDGE = 512;
const DEFAULT_QUALITY = 0.85;
const DEFAULT_MIME_TYPE: OptimizeImageOptions["mimeType"] = "image/jpeg";
const DEFAULT_MAX_BYTES = 200 * 1024;

const ACCEPTED_INPUT_MIME = /^image\/(png|jpe?g|webp|gif|bmp|heic|heif)$/i;

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("read_invalid"));
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode_failed"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function approximateBase64Bytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return dataUrl.length;
  const payload = dataUrl.slice(commaIdx + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/**
 * Resize and compress a user-selected image so it can be safely saved as a
 * data URL on a Profile.MediaAsset row. Returns null if the input is not a
 * supported image type or cannot be decoded.
 */
export async function optimizeProfileImage(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<OptimizedImage | null> {
  if (!file || !ACCEPTED_INPUT_MIME.test(file.type)) return null;
  if (typeof document === "undefined") return null;

  const maxEdge = Math.max(64, Math.min(options.maxEdge ?? DEFAULT_MAX_EDGE, 1024));
  const mimeType = options.mimeType ?? DEFAULT_MIME_TYPE ?? "image/jpeg";
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let image: HTMLImageElement;
  try {
    image = await readFileAsImage(file);
  } catch {
    return null;
  }

  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  if (!naturalW || !naturalH) return null;

  // Center-crop to a square so the circular frame in the UI never shows
  // distorted content. We crop in source-image space, then scale on draw.
  const sourceEdge = Math.min(naturalW, naturalH);
  const sx = Math.floor((naturalW - sourceEdge) / 2);
  const sy = Math.floor((naturalH - sourceEdge) / 2);

  const targetEdge = Math.min(maxEdge, sourceEdge);

  const canvas = document.createElement("canvas");
  canvas.width = targetEdge;
  canvas.height = targetEdge;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, sourceEdge, sourceEdge, 0, 0, targetEdge, targetEdge);

  // Step the quality down if the encoded payload would still exceed the cap.
  // This keeps the database column small even when the input was huge.
  let quality = Math.max(0.4, Math.min(options.quality ?? DEFAULT_QUALITY, 1));
  let dataUrl = canvas.toDataURL(mimeType, quality);
  let bytes = approximateBase64Bytes(dataUrl);

  while (bytes > maxBytes && quality > 0.5) {
    quality = Math.max(0.5, quality - 0.1);
    dataUrl = canvas.toDataURL(mimeType, quality);
    bytes = approximateBase64Bytes(dataUrl);
  }

  return {
    dataUrl,
    bytes,
    width: targetEdge,
    height: targetEdge,
    mimeType,
  };
}
