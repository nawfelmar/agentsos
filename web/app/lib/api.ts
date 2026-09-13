// Same-origin proxy (/cp-api → control plane via next.config.js rewrites).
// Absolute NEXT_PUBLIC_AGENTOS_API overrides when set at build time.
const API = process.env.NEXT_PUBLIC_AGENTOS_API || "/cp-api";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("agentos_token");
}

export function getOrg(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("agentos_org");
}

export function setSession(token: string, org?: string) {
  localStorage.setItem("agentos_token", token);
  if (org) localStorage.setItem("agentos_org", org);
}

export function clearSession() {
  localStorage.removeItem("agentos_token");
  localStorage.removeItem("agentos_org");
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail || body);
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export { API };
