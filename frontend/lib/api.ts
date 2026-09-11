export type Account = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER" | "EMPLOYEE" | "ADMIN";
  department: string;
  position: string;
  crmAccess: boolean;
};
export type Row = {
  id: string;
  module: string;
  ownerId: string;
  assigneeId: string | null;
  data: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
};
export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  try {
    const headers: Record<string, string> = {};
    let body: BodyInit | undefined;
    if (method !== "GET") {
      const cr = await fetch("/api/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!cr.ok) throw new Error("unavailable");
      const csrf = await cr.json();
      headers[csrf.headerName] = csrf.token;
      if (data instanceof FormData || data instanceof URLSearchParams)
        body = data;
      else if (data !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(data);
      }
    }
    const response = await fetch(`/api${path}`, {
      method,
      headers,
      body,
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      let code =
        response.status === 401
          ? "unauthorized"
          : response.status === 403
            ? "forbidden"
            : "requestFailed";
      try {
        code = (await response.json()).error || code;
      } catch {}
      throw new Error(code);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  } catch (e) {
    if (e instanceof TypeError) throw new Error("unavailable");
    throw e;
  }
}
