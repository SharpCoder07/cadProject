import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { randomToken } from "./tokens";

// OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(passwordHash: string | null, password: string): Promise<boolean> {
  // Always run a verification so that unknown accounts take the same time.
  const target = passwordHash ?? (await dummyHash());
  try {
    const ok = await verify(target, password);
    return ok && passwordHash !== null;
  } catch {
    return false;
  }
}

// A real argon2id hash of a random string, computed once, used only to equalize timing.
let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hash(randomToken(), OPTIONS));

/** Password rule shared by every form that sets a password (lib/password-rules.ts). */
export { passwordProblems, type PasswordContext } from "@/lib/password-rules";
