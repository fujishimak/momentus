/** Thrown when the selected file is not an image (FR5). */
export class PhotoTypeError extends Error {
  constructor() {
    super("Please choose an image file.");
    this.name = "PhotoTypeError";
  }
}

/** True when the file is an image by MIME type. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export interface PreparePhotoOptions {
  /** Longest-edge cap in px for downscaling when a canvas is available. */
  maxEdge?: number;
}

/**
 * Validate and normalize a picked photo into a storage-ready Blob (FR5, one
 * photo per entry). Rejects non-images. When a DOM canvas is available and the
 * image exceeds `maxEdge`, the image is downscaled to keep local storage lean;
 * otherwise the original bytes pass through unchanged (e.g. in test/SSR).
 */
export async function preparePhoto(
  file: File,
  options: PreparePhotoOptions = {},
): Promise<Blob> {
  if (!isImageFile(file)) throw new PhotoTypeError();

  const maxEdge = options.maxEdge ?? 1600;
  const downscaled = await tryDownscale(file, maxEdge);
  return downscaled ?? file;
}

/**
 * Best-effort downscale using the DOM. Returns null when the browser imaging
 * APIs are unavailable (tests/SSR) or on any failure, so callers fall back to
 * the original file. Never throws.
 */
async function tryDownscale(file: File, maxEdge: number): Promise<Blob | null> {
  try {
    if (
      typeof document === "undefined" ||
      typeof createImageBitmap === "undefined"
    ) {
      return null;
    }
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    if (longest <= maxEdge) {
      bitmap.close?.();
      return null; // already small enough
    }
    const scale = maxEdge / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
    );
  } catch {
    return null;
  }
}
