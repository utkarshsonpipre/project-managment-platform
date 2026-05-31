// Lightweight client-side API helper.
// - sends cookies (same-origin) so the httpOnly access token is included
// - on a 401, transparently tries POST /api/auth/refresh once, then retries
// - throws ApiClientError with the server's message on failure

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (
    res.status === 401 &&
    allowRefresh &&
    path !== "/api/auth/refresh" &&
    path !== "/api/auth/login"
  ) {
    const refreshed = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (refreshed.ok) return apiFetch<T>(path, init, false);
  }

  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      (body as { error?: string }).error ?? "Request failed",
      (body as { issues?: { path: string; message: string }[] }).issues,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
