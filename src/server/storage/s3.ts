import "server-only";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/server/env";
import type { StorageDriver, StoredObject } from "./index";

/** Any S3-compatible store (AWS S3, Cloudflare R2, MinIO…). Configured only through environment variables. */
export class S3Storage implements StorageDriver {
  readonly provider = "s3" as const;
  readonly baseUrl = `${(env.STORAGE_PUBLIC_URL ?? "").replace(/\/$/, "")}/`;
  private client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "" },
  });

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    return { key, url: `${this.baseUrl}${key}`, provider: this.provider };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }

  async list(cursor: string | null, limit: number) {
    const res = await this.client.send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, MaxKeys: limit, ContinuationToken: cursor ?? undefined }));
    return { keys: (res.Contents ?? []).map((o) => o.Key!).filter(Boolean), next: res.NextContinuationToken ?? null };
  }
}
