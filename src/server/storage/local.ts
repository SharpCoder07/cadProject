import "server-only";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredObject } from "./index";

/**
 * Writes to public/uploads. Suitable for local development or a single server
 * with a persistent disk. Not suitable for serverless hosts, whose filesystem is
 * wiped on every deploy.
 */
export class LocalStorage implements StorageDriver {
  readonly provider = "local" as const;
  readonly baseUrl = "/uploads/";
  private root = path.join(process.cwd(), "public", "uploads");

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { key, url: `${this.baseUrl}${key}`, provider: this.provider };
  }

  async get(key: string): Promise<Buffer | null> {
    return readFile(this.resolve(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
  }

  async list(cursor: string | null, limit: number) {
    const all = (await this.walk(this.root)).sort();
    const from = cursor ? all.findIndex((k) => k > cursor) : 0;
    if (from < 0) return { keys: [], next: null };
    const keys = all.slice(from, from + limit);
    return { keys, next: from + limit < all.length ? keys[keys.length - 1]! : null };
  }

  /** Number of files in public/uploads. */
  async count() {
    return (await this.walk(this.root)).length;
  }

  private async walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const out: string[] = [];
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...(await this.walk(full)));
      else if (e.isFile()) out.push(path.relative(this.root, full).split(path.sep).join("/"));
    }
    return out;
  }

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return target;
  }
}
