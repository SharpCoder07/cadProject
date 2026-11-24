/**
 * Next.js instrumentation. `onRequestError` runs for every error Next.js catches while rendering a page or running a
 * route handler or middleware, and records it in Logs › Error logs (src/server/error-log.ts) as a server error
 * (or a database error when the database caused it). Only on the Node.js runtime, where the database is reachable.
 */
export async function register() {}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { fromException, recordError } = await import("@/server/error-log");
  const input = fromException(err, "SERVER", {
    source: request.path,
    method: request.method,
    statusCode: 500,
    userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null,
  });
  input.details = `${input.details ?? ""}\n\nRoute: ${context.routePath} (${context.routeType}${context.renderSource ? `, ${context.renderSource}` : ""})`.trim();
  await recordError(input);
}
