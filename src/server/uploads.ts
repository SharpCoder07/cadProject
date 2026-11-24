import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";

/** Allowed upload types, detected from file content (magic bytes), never from the name or browser-supplied type. */
export const ALLOWED_TYPES = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/avif": { ext: "avif", kind: "image" },
  "application/pdf": { ext: "pdf", kind: "document" },
} as const;

export type AllowedMime = keyof typeof ALLOWED_TYPES;

export interface ProcessedUpload {
  buffer: Buffer;
  mimeType: AllowedMime;
  ext: string;
  width: number | null;
  height: number | null;
  checksum: string;
  storageKey: string;
  sizeBytes: number;
}

const MAX_IMAGE_EDGE = 2560;

/**
 * Validates and normalises an uploaded file.
 * - Detects the real type from content; rejects SVG, HTML, executables, archives.
 * - Enforces the size limit before decoding.
 * - Re-encodes raster images with sharp, which strips EXIF/GPS metadata and
 *   neutralises polyglot payloads; very large images are downscaled.
 */
export async function processUpload(input: Buffer, originalName: string): Promise<ProcessedUpload> {
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (input.byteLength === 0) throw new AppError("The file is empty.");
  if (input.byteLength > maxBytes) throw new AppError(`Files must be ${env.MAX_UPLOAD_MB} MB or smaller.`);

  const detected = await fileTypeFromBuffer(input);
  const mime = detected?.mime as AllowedMime | undefined;
  if (!mime || !(mime in ALLOWED_TYPES)) {
    throw new AppError("Unsupported file type. Upload JPG, PNG, WebP, GIF, AVIF or PDF.");
  }
  const meta = ALLOWED_TYPES[mime];

  let buffer = input;
  let width: number | null = null;
  let height: number | null = null;

  if (meta.kind === "image") {
    const animated = mime === "image/gif";
    try {
      // failOn "none": accept images with harmless decoder warnings (e.g. a PNG's "incorrect sRGB
      // profile" or trailing bytes after a JPEG) that every browser displays fine. Truly broken data
      // still fails when it is re-encoded below.
      const pipeline = sharp(input, { animated, limitInputPixels: 50_000_000, failOn: "none" }).rotate();
      const info = await pipeline.metadata();
      const resized =
        (info.width ?? 0) > MAX_IMAGE_EDGE || (info.height ?? 0) > MAX_IMAGE_EDGE
          ? pipeline.resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
          : pipeline;
      const out = await resized.toFormat(meta.ext === "jpg" ? "jpeg" : (meta.ext as "png" | "webp" | "gif" | "avif")).toBuffer({ resolveWithObject: true });
      buffer = out.data;
      width = out.info.width;
      height = animated ? (info.pageHeight ?? out.info.height) : out.info.height;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error(`[upload] image processing failed for "${originalName}" (${mime}, ${input.byteLength} bytes): ${reason}`);
      if (/pixel limit/i.test(reason)) throw new AppError("This image is too large (over 50 megapixels). Resize it and try again.");
      throw new AppError(`That image couldn't be read. It may be corrupted.${env.NODE_ENV === "production" ? "" : ` (${reason})`}`);
    }
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const now = new Date();
  const base = originalName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "file";
  const storageKey = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${base}-${randomBytes(6).toString("hex")}.${meta.ext}`;

  return { buffer, mimeType: mime, ext: meta.ext, width, height, checksum, storageKey, sizeBytes: buffer.byteLength };
}

/** Validates and stores a single image outside the media library (avatars, branding). Returns its public URL. */
export async function storeImage(input: Buffer, originalName: string, folder: "avatars" | "branding", maxMb = 5): Promise<string> {
  if (input.byteLength > maxMb * 1024 * 1024) throw new AppError(`Images must be ${maxMb} MB or smaller.`);
  const processed = await processUpload(input, originalName);
  if (!processed.mimeType.startsWith("image/")) throw new AppError("Upload a JPG, PNG, WebP, GIF or AVIF image.");
  const { getStorage } = await import("@/server/storage");
  const stored = await (await getStorage()).put(`${folder}/${processed.storageKey}`, processed.buffer, processed.mimeType);
  return stored.url;
}
