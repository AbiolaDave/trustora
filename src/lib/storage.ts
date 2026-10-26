import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

/**
 * PRIVATE file storage for ID documents and job photos. Files are never served from /public.
 * Cloudinary assets use authenticated delivery and are read only after the app's access checks.
 * Development without Cloudinary credentials saves to ./.private-uploads.
 */
const DIR = path.join(process.cwd(), ".private-uploads");
const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const KEY_PATTERN = /^(c_)?([a-f0-9]{32})\.(jpg|png|webp|pdf)$/;

function cloudinaryConfigured() {
  const credentials = [env.CLOUD_NAME, env.CLOUD_API_KEY, env.CLOUD_API_SECRET];
  if (credentials.some(Boolean) && !credentials.every(Boolean)) {
    throw new Error("Set CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET to enable Cloudinary uploads.");
  }
  return credentials.every(Boolean);
}

function cloudinaryClient() {
  if (!cloudinaryConfigured()) {
    throw new Error("Set CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET to enable Cloudinary uploads.");
  }
  cloudinary.config({
    cloud_name: env.CLOUD_NAME,
    api_key: env.CLOUD_API_KEY,
    api_secret: env.CLOUD_API_SECRET,
  });
  return cloudinary;
}

async function saveToCloudinary(file: File, key: string, ext: string) {
  const id = key.slice(2, key.lastIndexOf("."));
  const resourceType = ext === "pdf" ? "raw" : "image";
  const publicId = resourceType === "raw" ? `${id}.${ext}` : id;
  const client = cloudinaryClient();
  const bytes = Buffer.from(await file.arrayBuffer());

  await new Promise<void>((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      public_id: publicId,
      resource_type: resourceType,
      type: "authenticated",
      overwrite: false,
      unique_filename: false,
    }, (error, result) => {
      if (error) reject(error);
      else if (!result) reject(new Error("Cloudinary did not return an upload result."));
      else resolve();
    });
    stream.on("error", reject);
    Readable.from([bytes]).pipe(stream);
  });
}

export async function savePrivateFile(file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Only JPG, PNG, WebP or PDF files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is too large. Maximum is 5 MB.");
  const useCloudinary = cloudinaryConfigured();
  const key = `${useCloudinary ? "c_" : ""}${randomBytes(16).toString("hex")}.${ext}`;
  if (useCloudinary) {
    await saveToCloudinary(file, key, ext);
    return key;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("File uploads are not configured. Set CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET.");
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, key), Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readPrivateFile(key: string) {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  const [, cloudinaryKey, id, ext] = match;
  if (!id || !ext) return null;
  const type = Object.entries(ALLOWED).find(([, allowedExt]) => allowedExt === ext)![0];

  if (cloudinaryKey) {
    const resourceType = ext === "pdf" ? "raw" : "image";
    const publicId = resourceType === "raw" ? `${id}.${ext}` : id;
    const url = cloudinaryClient().utils.private_download_url(publicId, ext, {
      resource_type: resourceType,
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cloudinary file download failed (${response.status}).`);
    return { data: Buffer.from(await response.arrayBuffer()), type };
  }

  try {
    return { data: await readFile(path.join(DIR, key)), type };
  } catch {
    return null;
  }
}
