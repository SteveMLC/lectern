export type ErrorStatus = 400 | 401 | 403 | 404 | 405 | 409 | 413 | 422 | 500 | 503;

/**
 * Uniform JSON error body matching the ApiError contract. Returned as a plain
 * Response so any handler or middleware can use it without Hono generics.
 */
export function errorResponse(
  status: ErrorStatus,
  code: string,
  message: string,
  issues?: unknown[],
): Response {
  return new Response(
    JSON.stringify({ error: { code, message, ...(issues ? { issues } : {}) } }),
    { status, headers: { "content-type": "application/json; charset=utf-8" } },
  );
}
