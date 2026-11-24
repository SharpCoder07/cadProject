import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

// Next.js request-scoped APIs aren't available in unit/integration tests.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "vitest" }),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}));

process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.APP_URL ??= "http://localhost:3000";
// Always use the test database from .env.test (or TEST_DATABASE_URL): integration tests truncate every table.
function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const file = readFileSync(path.resolve(__dirname, "../.env.test"), "utf8");
    const m = file.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (m?.[1]) return m[1];
  } catch {
    /* fall through */
  }
  throw new Error("Set DATABASE_URL in .env.test (or TEST_DATABASE_URL) to a database whose name contains 'test'.");
}
process.env.DATABASE_URL = testDatabaseUrl();
