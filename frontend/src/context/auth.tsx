import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { API, ApiError, apiGet, apiPost, clearToken, loadToken, setToken } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

const REMEMBER_KEY = "sha_remember_me";
const USER_CACHE_KEY = "sha_cached_user";

WebBrowser.maybeCompleteAuthSession();

export type Role = "student" | "coach" | null;

export type User = {
  user_id: string;
  name: string | null;
  email: string | null;
  role: Role;
  grade: number | null;
  student_code: string | null;
  picture: string | null;
  has_password?: boolean;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: "student" | "coach" | "parent";
    grade?: number;
  }) => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  googleLogin: () => Promise<void>;
  completeProfile: (role: "student" | "coach", grade?: number) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processedSessionIds = useRef<Set<string>>(new Set());

  const applySession = useCallback(async (sessionId: string) => {
    if (processedSessionIds.current.has(sessionId)) return;
    processedSessionIds.current.add(sessionId);
    const res = await apiPost("/auth/session", { session_id: sessionId });
    await setToken(res.session_token);
    await storage.setItem(REMEMBER_KEY, true);
    setUser(res.user);
  }, []);

  const checkExisting = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setUser(null);
      return;
    }
    const remember = await storage.getItem(REMEMBER_KEY, true);
    if (remember === false) {
      // User did not opt to stay signed in; drop the session on relaunch.
      await clearToken();
      setUser(null);
      return;
    }
    try {
      const res = await apiGet("/auth/me");
      setUser(res.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        setUser(null);
        return;
      }
      // Network/server hiccup: keep the session and use the last known user.
      const cached = await storage.getItem(USER_CACHE_KEY, "");
      setUser(cached ? JSON.parse(String(cached)) : null);
    }
  }, []);

  useEffect(() => {
    if (user) storage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    let mounted = true;
    let sub: { remove: () => void } | null = null;

    (async () => {
      try {
        // Web: process session_id in URL first
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid =
            extractSessionId(window.location.hash) || extractSessionId(window.location.search);
          if (sid) {
            try {
              await applySession(sid);
              const url = new URL(window.location.href);
              url.hash = "";
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.toString());
            } catch {
              /* ignore */
            }
            if (mounted) setLoading(false);
            return;
          }
        } else {
          // Mobile cold start
          const initialUrl = await Linking.getInitialURL();
          const sid = extractSessionId(initialUrl);
          if (sid) {
            try {
              await applySession(sid);
            } catch {
              /* ignore */
            }
            if (mounted) setLoading(false);
            return;
          }
        }
        await checkExisting();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", ({ url }) => {
        const sid = extractSessionId(url);
        if (sid) applySession(sid).catch(() => {});
      });
    }

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [applySession, checkExisting]);

  const register: AuthState["register"] = useCallback(async (data) => {
    const res = await apiPost("/auth/register", data);
    await setToken(res.session_token);
    await storage.setItem(REMEMBER_KEY, true);
    setUser(res.user);
  }, []);

  const login: AuthState["login"] = useCallback(async (email, password, remember = true) => {
    const res = await apiPost("/auth/login", { email, password });
    await setToken(res.session_token);
    await storage.setItem(REMEMBER_KEY, remember);
    setUser(res.user);
  }, []);

  const googleLogin: AuthState["googleLogin"] = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    let captured: string | null = null;
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (!captured) captured = url;
    });
    try {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      let sid: string | null = null;
      if (result.type === "success" && (result as any).url) {
        sid = extractSessionId((result as any).url);
      }
      if (!sid) sid = extractSessionId(captured);
      if (!sid) sid = extractSessionId(await Linking.getInitialURL());
      if (sid) {
        await applySession(sid);
      }
    } finally {
      sub.remove();
    }
  }, [applySession]);

  const completeProfile: AuthState["completeProfile"] = useCallback(async (role, grade) => {
    const res = await apiPost("/auth/complete-profile", { role, grade });
    setUser(res.user);
  }, []);

  const refreshUser: AuthState["refreshUser"] = useCallback(async () => {
    try {
      const res = await apiGet("/auth/me");
      setUser(res.user);
    } catch {
      /* ignore */
    }
  }, []);

  const logout: AuthState["logout"] = useCallback(async () => {
    try {
      await apiPost("/auth/logout");
    } catch {
      /* ignore */
    }
    await clearToken();
    await storage.removeItem(USER_CACHE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, googleLogin, completeProfile, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
