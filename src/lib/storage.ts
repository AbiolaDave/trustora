import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

/**
 * PRIVATE file storage for ID documents and job photos. Files are never served from /public.
 * Development: saved to ./.private-uploads. Production: plug in S3/Cloudinary/R2 here; until then
 * uploads are refused rather than silently written to a server disk that may be wiped.
 */
const DIR = path.join(process.cwd(), ".private-uploads");
const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function savePrivateFile(file: File): Promise<string> {
  if (env.NODE_ENV === "production" && !env.UPLOAD_PROVIDER_CREDENTIALS) throw new Error("File uploads are not configured yet. Add a storage provider (see README).");
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Only JPG, PNG, WebP or PDF files are allowed.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is too large. Maximum is 5 MB.");
  const key = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, key), Buffer.from(await file.arrayBuffer()));
  return key;
}
export async function readPrivateFile(key: string) {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(key)) return null; // blocks path traversal
  try {
    const ext = key.split(".")[1]!;
    const type = Object.entries(ALLOWED).find(([, e]) => e === ext)![0];
    return { data: await readFile(path.join(DIR, key)), type };
  } catch {
    return null;
  }
}
