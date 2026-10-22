import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const API = `${BASE}/api`;
export const TOKEN_KEY = "sha_session_token";

let inMemoryToken: string | null = null;

export async function setToken(token: string) {
  inMemoryToken = token;
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  inMemoryToken = null;
  await storage.secureRemove(TOKEN_KEY);
}

export async function loadToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const t = await storage.secureGet(TOKEN_KEY, "");
  inMemoryToken = t || null;
  return inMemoryToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    if (res.status === 401) {
      await clearToken();
    }
    const detail = (data && (data.detail || data.message)) || "Bir hata oluştu";
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Bir hata oluştu");
  }
  return data;
}

// --- Admin (Müdür) panel — separate token namespace, not the user session ---
export const ADMIN_TOKEN_KEY = "sha_admin_token";

export async function adminLogin(username: string, password: string): Promise<void> {
  const res = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.detail) || "Giriş başarısız");
  }
  await storage.secureSet(ADMIN_TOKEN_KEY, data.token);
}

export async function adminStats(): Promise<any> {
  const token = await storage.secureGet(ADMIN_TOKEN_KEY, "");
  const res = await fetch(`${API}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data && data.detail) || "Hata");
  return data;
}

async function adminRequest(path: string, method = "GET", body?: any): Promise<any> {
  const token = await storage.secureGet(ADMIN_TOKEN_KEY, "");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data && data.detail) || "Hata");
  return data;
}

export const adminUsers = () => adminRequest("/admin/users");
export const adminResetPassword = (userId: string) =>
  adminRequest(`/admin/users/${encodeURIComponent(userId)}/reset-password`, "POST");
export const adminListQuotes = () => adminRequest("/admin/quotes");
export const adminAddQuote = (text: string, author: string) =>
  adminRequest("/admin/quotes", "POST", { text, author });
export const adminDeleteQuote = (id: string) =>
  adminRequest(`/admin/quotes/${encodeURIComponent(id)}`, "DELETE");
export async function getQuote(): Promise<{ quote: { text: string; author: string } | null }> {
  const res = await fetch(`${API}/quote`);
  if (!res.ok) throw new ApiError(res.status, "Hata");
  return res.json();
}

export async function adminLogout(): Promise<void> {
  await storage.secureRemove(ADMIN_TOKEN_KEY);
}

export const apiGet = (path: string) => request(path, { method: "GET" });
export const apiPost = (path: string, body?: any) =>
  request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPut = (path: string, body?: any) =>
  request(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = (path: string) => request(path, { method: "DELETE" });
